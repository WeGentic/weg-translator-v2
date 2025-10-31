#!/usr/bin/env python3
"""
Claude Code Hook: JSON Schema Validation
Triggers on SubagentStop event to validate agent JSON outputs
"""

import json
import sys
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Try to import jsonschema, provide helpful error if missing
try:
    import jsonschema
    from jsonschema import validate, ValidationError, Draft7Validator
except ImportError:
    print("ERROR: jsonschema package not installed", file=sys.stderr)
    print("Install with: pip3 install jsonschema", file=sys.stderr)
    sys.exit(2)


class AgentJSONValidator:
    """Validates JSON files created by Claude Code agents against project schemas"""

    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.schemas_dir = self.project_dir / ".claude" / "schemas"
        self.hooks_dir = self.project_dir / ".claude" / "hooks"
        self.agent_schema_map = self._load_agent_schema_map()

    def _load_agent_schema_map(self) -> Dict[str, str]:
        """Load agent-to-schema mapping from config file"""
        map_file = self.hooks_dir / "agent_schema_map.json"
        if map_file.exists():
            try:
                with open(map_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Could not load agent_schema_map.json: {e}", file=sys.stderr)
        return {}

    def _get_schema_from_filename(self, filename: str) -> Optional[str]:
        """Match file name patterns to schema files"""
        patterns = {
            r".*_TaskList\.json$": "task-file.json",
            r".*_plan\.json$": "plan-file.json",
            r".*_CodebaseAnalysis\.json$": "plan-file.json",
        }

        for pattern, schema_name in patterns.items():
            if re.match(pattern, filename, re.IGNORECASE):
                return schema_name
        return None

    def _get_schema_from_agent(self, agent_name: str) -> Optional[str]:
        """Get schema name based on agent name"""
        # Check explicit mapping first
        if agent_name in self.agent_schema_map:
            return self.agent_schema_map[agent_name]

        # Default mappings for known agents
        default_mappings = {
            "T-tasker": "task-file.json",
            "tasklist-agent-v2": "task-file.json",
            "task-updater-agent": "task-file.json",
            "input-analyzer": "plan-file.json",
            "specs-agent-v2": "plan-file.json",
        }

        return default_mappings.get(agent_name)

    def _load_schema(self, schema_name: str) -> Optional[Dict]:
        """Load a JSON schema file"""
        schema_path = self.schemas_dir / schema_name
        if not schema_path.exists():
            return None

        try:
            with open(schema_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading schema {schema_name}: {e}", file=sys.stderr)
            return None

    def _extract_json_files_from_transcript(self, transcript_path: str) -> List[Tuple[str, str]]:
        """
        Extract JSON files written during agent execution from transcript.
        Returns list of (operation, file_path) tuples
        """
        json_files = []

        if not os.path.exists(transcript_path):
            return json_files

        try:
            with open(transcript_path, 'r') as f:
                content = f.read()

            # Look for Write and Edit tool uses with file_path containing .json
            # Pattern matches: "file_path": "/path/to/file.json"
            file_pattern = r'"file_path":\s*"([^"]+\.json)"'
            matches = re.findall(file_pattern, content)

            for file_path in matches:
                # Only include relevant JSON files (not node_modules, dist, etc.)
                if self._is_relevant_json_file(file_path):
                    json_files.append(("write", file_path))

        except Exception as e:
            print(f"Warning: Could not parse transcript: {e}", file=sys.stderr)

        return list(set(json_files))  # Remove duplicates

    def _is_relevant_json_file(self, file_path: str) -> bool:
        """Check if JSON file is relevant for validation"""
        # Exclude common directories that shouldn't be validated
        exclude_patterns = [
            r"node_modules/",
            r"\.next/",
            r"dist/",
            r"build/",
            r"target/",
            r"\.git/",
            r"package-lock\.json$",
            r"pnpm-lock\.json$",
            r"yarn\.lock$",
        ]

        for pattern in exclude_patterns:
            if re.search(pattern, file_path):
                return False

        # Include files in tasks/, .claude/schemas/, or root-level project JSON files
        include_patterns = [
            r"tasks/.*\.json$",
            r"\.claude/schemas/.*\.json$",
            r"[^/]+_TaskList\.json$",
            r"[^/]+_plan\.json$",
            r"[^/]+_CodebaseAnalysis\.json$",
        ]

        for pattern in include_patterns:
            if re.search(pattern, file_path):
                return True

        return False

    def validate_file(self, file_path: str, agent_name: str) -> Tuple[bool, List[str]]:
        """
        Validate a JSON file against its schema.
        Returns (is_valid, error_messages)
        """
        errors = []

        # Convert to Path object
        file_path_obj = Path(file_path)
        if not file_path_obj.is_absolute():
            file_path_obj = self.project_dir / file_path

        # Check if file exists
        if not file_path_obj.exists():
            return True, []  # File doesn't exist, skip validation

        # Determine schema using dual matching strategy
        filename = file_path_obj.name
        schema_from_file = self._get_schema_from_filename(filename)
        schema_from_agent = self._get_schema_from_agent(agent_name)

        # Choose schema (prefer file pattern, then agent)
        schema_name = schema_from_file or schema_from_agent

        if not schema_name:
            # No schema mapping found, skip validation
            return True, []

        # Verify both methods agree if both provided a schema
        if schema_from_file and schema_from_agent and schema_from_file != schema_from_agent:
            errors.append(
                f"Schema mismatch: File pattern suggests '{schema_from_file}' "
                f"but agent '{agent_name}' suggests '{schema_from_agent}'"
            )

        # Load schema
        schema = self._load_schema(schema_name)
        if not schema:
            errors.append(f"Could not load schema: {schema_name}")
            return False, errors

        # Load JSON file
        try:
            with open(file_path_obj, 'r') as f:
                json_data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON syntax in {filename}:")
            errors.append(f"  Line {e.lineno}, Column {e.colno}: {e.msg}")
            return False, errors
        except Exception as e:
            errors.append(f"Error reading {filename}: {str(e)}")
            return False, errors

        # Validate against schema
        try:
            validator = Draft7Validator(schema)
            validation_errors = sorted(validator.iter_errors(json_data), key=lambda e: e.path)

            if validation_errors:
                errors.append(f"Schema validation failed for {filename} (schema: {schema_name}):")
                errors.append("")

                for i, error in enumerate(validation_errors[:10], 1):  # Limit to 10 errors
                    path = "root" + "".join(f"[{p!r}]" if isinstance(p, int) else f".{p}" for p in error.path)
                    errors.append(f"  {i}. At {path}:")
                    errors.append(f"     {error.message}")

                    if error.validator == "required":
                        errors.append(f"     Missing required field(s): {error.message}")
                    elif error.validator == "pattern":
                        errors.append(f"     Value does not match pattern: {error.validator_value}")
                    elif error.validator == "enum":
                        errors.append(f"     Allowed values: {error.validator_value}")
                    errors.append("")

                if len(validation_errors) > 10:
                    errors.append(f"  ... and {len(validation_errors) - 10} more errors")

                return False, errors

        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
            return False, errors

        return True, []


def main():
    """Main hook entry point"""
    # Read hook input from stdin
    try:
        hook_input = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("Error: Could not parse hook input JSON", file=sys.stderr)
        sys.exit(0)  # Non-blocking error

    # Extract relevant information
    project_dir = hook_input.get("cwd", os.getcwd())
    transcript_path = hook_input.get("transcript_path", "")
    hook_event = hook_input.get("hook_event_name", "")

    # For SubagentStop, we might have additional context
    # Try to infer agent name from transcript or environment
    agent_name = os.environ.get("CLAUDE_AGENT_NAME", "unknown")

    # If transcript path available, try to extract agent name from it
    if transcript_path and os.path.exists(transcript_path):
        try:
            with open(transcript_path, 'r') as f:
                content = f.read()
                # Look for agent invocations in transcript
                agent_match = re.search(r'"subagent_type":\s*"([^"]+)"', content)
                if agent_match:
                    agent_name = agent_match.group(1)
        except:
            pass

    # Initialize validator
    validator = AgentJSONValidator(project_dir)

    # Extract JSON files from transcript
    json_files = validator._extract_json_files_from_transcript(transcript_path)

    if not json_files:
        # No JSON files found, pass through
        sys.exit(0)

    # Validate each file
    all_valid = True
    all_errors = []

    for operation, file_path in json_files:
        is_valid, errors = validator.validate_file(file_path, agent_name)

        if not is_valid:
            all_valid = False
            all_errors.extend(errors)
            all_errors.append("")  # Blank line between files

    if not all_valid:
        # Print errors to stderr (will be fed back to Claude)
        print("=" * 70, file=sys.stderr)
        print("JSON SCHEMA VALIDATION FAILED", file=sys.stderr)
        print("=" * 70, file=sys.stderr)
        print("", file=sys.stderr)
        print("Agent:", agent_name, file=sys.stderr)
        print("", file=sys.stderr)

        for error_line in all_errors:
            print(error_line, file=sys.stderr)

        print("=" * 70, file=sys.stderr)
        print("Please fix the validation errors and try again.", file=sys.stderr)
        print("Refer to the schema file in .claude/schemas/ for requirements.", file=sys.stderr)
        print("=" * 70, file=sys.stderr)

        # Exit code 2 = blocking error, feeds stderr back to Claude
        sys.exit(2)

    # All validations passed
    if json_files:
        print(f"✓ Validated {len(json_files)} JSON file(s) successfully", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
