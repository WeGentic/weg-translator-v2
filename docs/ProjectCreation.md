## CONTEXT
- src/modules/projects/components/wizard-v2
- docs/db-refactor-summary.md
- related rust code

## TASK
Wire the the Project creation wizard to the database writing code, strictly following this flow:

1. When user click on “Finalize” create a proper Project-specific folder in the Projects folder (app root/Projects). Folder will be named as the Project name. ERROR management: if fails, return an error message in an elegant and visually appealing way
2. Generate a proper Project UUID. ERROR management: if fails, rollback
3. Store Project data in the Sqlite database following the current schema and using the current code. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details
4. Create three subfolders: Projects/{project_name}/Translations, Projects/{project_name}/References, Projects/{project_name}/Instructions. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details
5. Copy the selected files in the proper folders, according to Translation Role. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details
6. Update the sqlite database  project table with files, according to current schemas. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details.
7.  Wire the conversion mechanics for document to XLF conversion:
    1. Create a subfolder for each of Project language pairs selected, e.g. Projects/{project_name}/Translations/en-US_it-IT
    2. For each language, convert the document file with Translation Role into xlf, showing a visually appealing loader during the conversion step.
8. Double check that everything is correct and close the wizard