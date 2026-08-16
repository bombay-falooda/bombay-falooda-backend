# POS Terminal QA

## Backend setup

Run from `bombay-falooda-backend`:

```bash
npm run db:migrate
npm run db:generate
npm run start:dev
```

The migration adds POS terminal fields for customer email, printable bill notes, and selected add-ons on bill/order items.

## POS client setup

Run from `bombay-falooda-clients/pos`:

```bash
npm install
npm run dev -- -p 3002
```

Open `http://localhost:3002/login`.

## Required test data

A POS device must be:

- `ACTIVE`
- linked to an `ACTIVE` outlet
- configured with a PIN
- inside `validFrom` and `validUntil` when it is temporary

Use the POS `accessKey` and PIN to log in.

## Flow to test

1. Log in with POS access key and PIN.
2. Confirm outlet menu loads from outlet menu availability.
3. Add menu items and add-ons to the bill.
4. Hold the bill.
5. Generate KOT.
6. Add more items to the same held bill.
7. Generate another KOT.
8. Select payment method and finalize the bill.
9. Use Print KOT / Bill for the browser print copy.
10. Check held bills, digital order queue, and shift summary refresh.

## Current printer note

Browser print is implemented now. Native ESC/POS auto-print should be added after the exact printer model, Windows driver, paper width, and USB/network connection method are confirmed.
