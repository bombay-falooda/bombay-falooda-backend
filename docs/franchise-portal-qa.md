# Franchise Portal QA Checklist

## Commands
```powershell
cd "C:\Node js\zynteq-solutions\BombayFalooda\bombay-falooda-backend"
npm run typecheck
npm run start:dev
```

```powershell
cd "C:\Node js\zynteq-solutions\BombayFalooda\bombay-falooda-clients\franchise"
npm run lint
npm run dev -- --port 3001
```

## Demo Data
```powershell
cd "C:\Node js\zynteq-solutions\BombayFalooda\bombay-falooda-backend"
$env:SEED_DEMO_FRANCHISE="true"
npm run db:seed
```

Demo owner:
- Email: `owner@bombayfalooda.com`
- Password: `Owner@12345`

Run these checks with two different franchise owner accounts to verify scoping.

## Auth
- Login with a franchise owner account succeeds.
- Login with a superadmin account is rejected by the franchise frontend.
- Login with a staff/POS account is rejected by the franchise frontend.

## Scoping
- Franchise owner A cannot update outlet IDs from franchise B.
- Franchise owner A cannot update POS IDs from franchise B.
- Franchise owner A cannot update team user IDs from franchise B.
- Franchise owner A cannot route orders to POS devices from franchise B.

## Permissions
- `canManageMenu=false` blocks menu category, item, add-on, and outlet availability changes.
- `canManageOutletStaff=false` blocks team create/edit/deactivate and outlet setting updates.
- `canViewReports=false` blocks reports.
- `canRouteOrders=false` blocks order route updates.
- `canRequestExtraPos=false` blocks POS request/status actions.

## Workflows
- Create staff user assigned to an outlet.
- Edit staff user.
- Deactivate staff user.
- Create menu category.
- Create menu item.
- Upload/select item image.
- Create add-on group.
- Create add-on option.
- Set outlet-wise menu availability and price.
- Request permanent POS.
- Request temporary POS.
- Create/update order route.
- Update outlet settings.
- Update franchise profile.
- View reports by hour, 4 hours, day, week, and month.
- View alerts and audit logs.
