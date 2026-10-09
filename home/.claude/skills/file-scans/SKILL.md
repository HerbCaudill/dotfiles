---
name: file-scans
description: Rename, merge, and file the family's scanned PDFs into year folders in Google Drive. Use when Herb asks to file, sort, name, organize, or clean up his scans.
---

# File scans

The scans folder is `~/Library/CloudStorage/GoogleDrive-herb@devresults.com/My Drive/Family/Scans`. The scanner software names each file `YYYYMMDD_<first line of OCR text>.pdf`, using the scan date. Those names are often junk, and the date is not the document's date.

## Scope

New scans arrive in two inboxes: PDFs loose at the top level of the scans folder, and PDFs in `Lynne Inbox`. File both the same way. Year folders are in scope too: rename any file there that does not yet follow the naming rules, and move it if it is in the wrong year. Leave `~Older` alone unless Herb asks otherwise.

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

Merge scans that logically form one document, such as the pages of one letter scanned separately or a policy packet split across files. Order pages as they read. Do not merge separate documents that merely arrived together, like two different bills from the same sender or several receipts from one trip. Delete exact duplicate scans, keeping the better copy.

Split scans that hold more than one document, such as a bank statement followed by a tax form, or a stray handwritten note at the end of a packet. Each part gets its own name and date. A page that is merely the back of a sheet (bleed-through, scrap paper reused for notes) stays with its front.

## Process

1. **Read.** List the inbox PDFs. For each, read the first two pages with `pdftotext -l 2 <file> -`. If the text is garbage or empty, render the first page with `pdftoppm -r 80 -png -f 1 -l 1 <file> <tmpdir>/page` and look at the image. Delegate reading to parallel subagents when there are more than about 30 files.
2. **Propose.** Write a plan as JSON in a scratch directory outside Drive: an array of `{ "sources": [...], "target": "..." }` entries with paths relative to the scans folder and sources in page order. To split a scan, give it one entry per part with `"pages": "1-2"` (or `"1,3"`); together they must cover every page once. To delete a duplicate, use `"target": null`. Show Herb the proposals, marking merges, splits, deletions and anything uncertain. For more than a few dozen files, write a standalone HTML review page with its own styles (not T3 theme variables) and `open` it. Ask about uncertain items rather than guessing.
3. **Apply.** After Herb approves, run `node scripts/applyFilingPlan.ts <scans folder> <plan.json>` from this skill's directory. It checks the whole plan before changing anything, refuses to overwrite, verifies page counts of merges and splits, deletes merged, split and duplicate sources (they go to Drive's trash for 30 days), and appends each change to `.filing-log.jsonl` in the scans folder.
4. **Report.** Say how many documents were filed and merged, and list anything left in the inboxes and why.

For a first run or after changing these rules, do a batch of about 20 files before the rest.

## Unattended runs

The morning briefing runs this skill on a schedule with nobody to review the plan. Herb has authorized unattended runs to apply the full plan, including merges, splits, and duplicate deletions, without approval. In that mode:

- Only file scans from the inboxes. Do not rename anything already in the year folders.
- Before filing a scan, compare it with documents already filed near its date (same sender, same date, or same subject in that year's folder). If it is the same document, delete the new scan as a duplicate instead of filing a second copy.
- Write the plan to a scratch directory outside Drive, then apply it. Do not ask questions; settle uncertain dates and identities with the rules above and record the doubt instead.
- If the script rejects the plan, fix the plan and retry. Never force an overwrite. Leave a file in its inbox if it still cannot be filed, and say why.
- Report what was filed, and separately what needs Herb's attention: payment demands, fines, deadlines, appointments, tax, legal, or official notices that ask for action, anything a family member must sign or bring somewhere, and anything filed with low confidence. Name the document by its new path, and give the deadline or amount when there is one. Ordinary statements, receipts, and confirmations need no attention.

## Drive stalls

Drive for desktop can hang indefinitely when many online-only files are read at once, and a few files can stay stuck even after the folder is made available offline. Read with a timeout (`timeout 15 pdfinfo …`). If reads hang, download the files through the Drive API instead (`gws-delegated drive files get --params '{"fileId":"…","alt":"media"}' --output <path>`; the scans folder ID is `1a8cuUGYF2TSdu06cHAjU948qXRkyAZVB`) into a local cache and read from there. Renames and moves still work on stuck files. To merge or split a stuck file, run the script against a temporary folder holding the cached copy, copy the results into Drive, then delete the original.
