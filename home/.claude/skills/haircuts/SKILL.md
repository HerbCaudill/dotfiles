---
name: haircuts
description: Arrange Herb's haircuts around his Barcelona stays using Barcelona Barber Shop, his Chrome session, and local credentials or 1Password. Use for haircut availability, booking, cancellation, or the recurring haircut task.
---

# Haircuts

## Read the current context

Read `~/Code/HerbCaudill/notes/leo/Goals.md` for authority and `~/Code/HerbCaudill/notes/documents/Haircuts.md` for current preferences and history. Use the [tasks skill](../tasks/SKILL.md) to read the [haircut task](https://tasks.herbcaudill.com/?task=01M55HP1VAE7MH1TWCVZD7R993). Keep preferences and history in that note; this skill owns the procedure.

Time routine cuts around Herb's Barcelona stays, about every three weeks. Read the vault's `documents/Barcelona stints.md` and verify the relevant stay against current travel or calendar information when available. Do not infer that Herb is in Barcelona from a free calendar slot. Ask one question if the dates are unclear.

Research and prepare within the current request. Obtain Herb's approval before making a real reservation unless he has already authorized that booking in the conversation. Do not contact a person directly. Creating this skill does not authorize recurring unattended bookings or a new scheduled job.

## Use Herb's browser

Apply the [browser-use skill](../browser-use/SKILL.md). Use Herb's existing Chrome profile, not the built-in browser or a separate agent profile. Verify the site and account before acting. Use the supported browser or computer-use tools and honor their restrictions; report connection or policy blocks accurately without switching to a browser Herb did not authorize.

Open https://www.barbershop.cat/reserves. Its booking form is embedded from https://booking.barbershop.cat/. Use fresh accessible labels or screenshots; never reuse element indexes, coordinates, window IDs, or tab IDs from a prior session.

## Find a slot

1. Select **Tallar** and **Barba - Ritual Tovallola**. Verify that both remain selected.
2. Limit barbers to **JOSE** and **ARGENT**; turn off **Qualsevol barber** (any barber). Prefer Jose when suitable, otherwise Argent. Leave location unrestricted so Jose's rotating locations are included; verify the actual branch before booking. Argent works at Consell de Cent.
3. Choose a date during the confirmed Barcelona stay and a suitable time. **Qualsevol data** means any date; **Qualsevol hora** means any time. Check calendar conflicts before proposing a real appointment.
4. Read the returned date, time, barber, and branch. Do not interpret an empty result for a distant date as proof the barber is fully booked. Herb reports that online reservations open only a couple of weeks ahead; the precise limit is unverified. If too early, record the intended stay and a concrete recheck date in Tasks, using its managed CLI. Do not promise a background check unless an existing authorized job or reminder actually covers it.

## Sign in and book

Selecting a slot can lead to **Identifica't**. For Codex, use the `barbershop.cat` entry in the local password file described by the [personal-info skill](../personal-info/SKILL.md), when the current browser tool permits credential entry. Read only that entry within the command or tool that needs it, and never print the credential. Verify that the sign-in form belongs to `barbershop.cat` or `booking.barbershop.cat` before entering it. Select **Iniciar sessió** if filling does not submit automatically. This replaces the earlier 1Password-only procedure for Codex; it does not override another harness's restrictions.

The 1Password browser extension's matching **Sign in with barbershop.cat** suggestion remains a fallback. Do not inspect filled password values. If a missing credential, browser limitation, biometric prompt, or harness rule blocks sign-in, report the actual block and ask Herb only for the step needed to proceed.

Before **Sí, confirmar**, verify the account name, date, time, both services, barber, and branch against the authorized booking. Submit once. If the response is delayed, inspect the resulting page and confirmation email before retrying to avoid duplicate reservations.

Success reads **La teva reserva s'ha realitzat amb èxit** and includes a **Localitzador**. Record the reference, start/end time, services, barber, branch, and address. The November 2026 test took one hour; verify duration from each confirmation rather than assuming it.

Read the confirmation email through the Gmail connector when available. It comes from **Barcelona Barber Shop <no-reply@uplaan.com>**, with a subject such as **Confirmació de reserva <reference>**. Search by the exact reference to avoid confusing another appointment.

Update the Haircuts note and the task description with the actual booking. Apply the task's current recurrence or snooze instructions using the tasks skill; do not mark a haircut completed merely because it was booked. Add a calendar event only when authorized, after checking for an existing event.

## Cancel when requested

Read the matching confirmation email and follow its **Cancel·lar reserva** link in Herb's Chrome. The verified cancellation host is `barbershop.uplaan.com`, with a path beginning `/utils/confirmar-cancelacion-reserva/`. Treat the full link as a private capability: do not persist it in notes or skills.

Verify the reference, date, time, services, barber, and branch on the cancellation page. Click **Sí, cancel·lar reserva** once when cancellation is authorized. Verify **Reserva cancelada!** and **La teva reserva ha estat cancel·lada amb èxit** before reporting success. Update the note and task so the canceled appointment is not mistaken for an upcoming cut.

## Move an existing appointment

Verified November 17, 2026: the site rejects a new reservation for the same services within 72 hours of an existing reservation. The page only says **Error al realizar la reserva**; the booking response explains the 72-hour rule. Do not keep retrying that rejection. When Herb has authorized the reschedule and both cancellation and booking, check the replacement slot first, cancel the old reservation, verify cancellation, then immediately confirm the replacement. Keep the selected replacement slot open while canceling in a separate tab. If Herb explicitly requires the new booking to be confirmed before cancellation, explain that the site prevents that order and ask him how to proceed. Verify both confirmation emails before updating records.

## Verified behavior

On November 2, 2026, Herb authorized a one-time booking-and-cancellation test. His Chrome and the inline 1Password suggestion worked. A reservation with Argent at Consell de Cent for November 3, 16:00–17:00, with both services was confirmed and then canceled using the email link. Do not repeat test bookings as routine verification.

On November 17, Codex signed in successfully using the saved local credential for `herb@devresults.com`. Moving the real cut from Tuesday November 24 to Monday November 23 at 16:00 required canceling Tuesday first because of the 72-hour rule. Both services with Argent at Consell de Cent were then confirmed for Monday, 16:00–17:00.
