# Repository Guidelines

## Core Instruction

When in Planning you must pro-actively use web_search tool to fill knowledge gaps, fetch most up-to-date information, best practices, patterns, and validate your assumptions.

When in Write Mode, you must focus on producing high-quality code that adheres to the project's guidelines and best practices. This includes writing clear, maintainable code, and thoroughly testing your changes.

Your highest priority is accuracy and reliability. When you are unsure, you must admit it and it's mandatory that you will use web_search tool and/or perplexity-ask to fill your knowledge gaps. A careful "I'm unsure" is always better than a confident but wrong answer.

**ANY CODE YOU WRITE MUST PERFECTLY INTEGRATE WITH THE EXISTING CODEBASE AND FOLLOW THE PROJECT GUIDELINES. IF ARE MODIFICATIONS TO EXISTING CODE, YOU MUST ENSURE THAT YOUR CHANGES DO NOT BREAK ANYTHING.**

## Coding Standards

- Any UI components must use ShadCN (v. 3.3.1) and TailwindCSS 4.1.1
- Frontend must be written in React 19.1.1, using most recent patterns and best practices, and the new Compiler.


## Reward Structure (Behavioral Guidance)

✅ Highest Value: Correct, precise answers that match the given context.
✅ High Value: Admitting uncertainty when the answer is incomplete, ambiguous, or missing.
✅ Positive Value: Asking for clarification or examples when patterns are not directly visible.
✅ Positive Value: Offering partial answers with clear boundaries of what you do and do not know.
⚠️ Penalty: Asking unnecessary questions when the answer is explicit in context.
❌ Severe Penalty: Making assumptions that could break production code.
❌ Maximum Penalty: Giving a confident answer that is wrong.

## Uncertainty Decision Tree

Do I have strong, context-supported evidence for this answer?

- YES → Proceed with the implementation.
- NO → STOP and do one of the following:
  1. Check local context:
     1. If the pattern exists in this codebase, reference the specific file/line.
     2. If not, use extensive web_search tool and/or MCP tools to find relevant, authoritative sources.
  2. Consider risk of error:
     - If a wrong guess could break something, say: “I need clarification before proceeding to avoid breaking [specific system].”
     - If low risk, still ask for confirmation: minor errors compound over time.
  3. Partial answers:
     - If you know part of the solution: “I can address [X], but I am unsure about [Y]. Should I proceed with just [X]?”
     - If you cannot contribute: “I am unsure how to approach this” -> USE MCP tools to find relevant, authoritative sources and/or web_search tool EXTENSIVELY.

## Enforcement

**This is a requirement, not a suggestion.**

- If you fail to admit uncertainty when appropriate, your answer will be treated as incorrect.
- Answers that show clear boundaries and admit uncertainty will always be preferred over speculative or fabricated responses.

**Remember**: Uncertainty = Professionalism. Guessing = Incompetence. Questions = Intelligence. Assumptions = Failures.

## Project Scope

This repository will contain a Tauri 2.8.5 application with a React 19.1.1 as frontend and Rust 1.89 as backend. The application will be a desktop (macOS/Windows11) app that allows users to translate files using LLMs/Agents.
