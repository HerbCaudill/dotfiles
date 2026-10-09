---
name: file-scans
description: Rename, merge, and file the family's scanned PDFs into year folders in Google Drive. Use when Herb asks to file, sort, name, organize, or clean up his scans.
---

# File scans

The scans folder is `~/Library/CloudStorage/GoogleDrive-herb@devresults.com/My Drive/Family/Scans`. The scanner software names each file `YYYYMMDD_<first line of OCR text>.pdf`, using the scan date. Those names are often junk, and the date is not the document's date.

## Scope

New scans arrive in two inboxes: PDFs loose at the top level of the scans folder, and PDFs in `Lynne Inbox`. File both the same way. Leave the year folders and `~Older` alone unless Herb asks otherwise.

## Naming rules

Name each document `YYYYMMDD Sender – Subject (Person).pdf`, with a spaced en dash.

- **Date.** Use the date printed on the document: letter date, notice date, statement date, or invoice date. If it has none, use the scan date from the file name. If that is implausible (before 1990 or after today), use the file's modification date.
- **Sender.** Use the short name people actually say: `IRS`, `USAA`, `TD Bank`, `Servei Català de Trànsit`, `Ajuntament de Barcelona`, `Hacienda`. Keep official names in their own language.
- **Subject.** Say in plain English what the document is, specifically enough to find it later: `CP2000 proposed changes to 2023 return`, `Renters policy packet 2024–25`, `Traffic fine notice`. Include the tax year or policy period when it matters.
- **Person.** Add `(Herb)`, `(Lynne)`, `(Calvin)`, or `(Ashe)` only when the document concerns one family member rather than the household. Lynne's surname on documents is McIntyre; Ashe may appear as Baird Caudill.
- Never put account numbers, ID numbers, amounts owed, or other sensitive values in a name.
- Avoid characters Drive or macOS handle badly: `/ : \ * ? " < > |`.

File each document in a folder named for its year, such as `2024/`, creating the folder if needed. This includes personal papers like Lynne's research notes and coursework; everything goes in the year folders.

## Merging

Merge scans that logically form one document, such as the pages of one letter scanned separately or a policy packet split across files. Order pages as they read. Do not merge separate documents that merely arrived together, like two different bills from the same sender or several receipts from one trip. Exact duplicate scans of the same document should be merged by keeping one copy: list only the better scan as a source and flag the other for Herb to decide.

## Process

1. **Read.** List the inbox PDFs. For each, read the first two pages with `pdftotext -l 2 <file> -`. If the text is garbage or empty, render the first page with `pdftoppm -r 80 -png -f 1 -l 1 <file> <tmpdir>/page` and look at the image. Delegate reading to parallel subagents when there are more than about 30 files.
2. **Propose.** Write a plan as JSON in a scratch directory outside Drive: an array of `{ "sources": [...], "target": "..." }` entries with paths relative to the scans folder and sources in page order. Show Herb a table of current name → proposed name, marking merges and anything uncertain. Ask about uncertain items rather than guessing.
3. **Apply.** After Herb approves, run `node scripts/applyFilingPlan.ts <scans folder> <plan.json>` from this skill's directory. It checks the whole plan before changing anything, refuses to overwrite, verifies merged page counts, deletes merged sources (they go to Drive's trash for 30 days), and appends each change to `.filing-log.jsonl` in the scans folder.
4. **Report.** Say how many documents were filed and merged, and list anything left in the inboxes and why.

For a first run or after changing these rules, do a batch of about 20 files before the rest.
