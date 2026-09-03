# PesaFlow System Documentation

## 1. Product Overview

PesaFlow is a personal-finance-first application with web and mobile clients. It supports personal transactions, savings, savings goals, business tracking, chama management, reporting, and user settings.

The application uses Supabase as its authentication provider, database, row-level security layer, and RPC backend. There is currently no separate application API server or Supabase Edge Function in production code.

The repository is an npm workspace:

- `packages/web`: React, TypeScript, Vite, Tailwind CSS, React Router, Recharts, and Supabase.
- `packages/mobile`: Expo, React Native, React Navigation, TypeScript, and Supabase.
- `supabase`: schema, migrations, optional seed data, and reserved Edge Function directory.
- `docs`: product and engineering documentation.

## 2. Current Release State

The mobile app is configured as version `1.0.0` with Android package `com.pesaflow.mobile` in the native Android project.

The first Android EAS build was submitted using the `preview` profile. That profile is configured to produce an APK. The build was submitted under the Expo project `@frankariuki/pesaflow-mobile` and reached the EAS free-tier queue.

For Google Play Store submission, the app should use a production profile that produces an Android App Bundle (AAB), not the preview APK. The current preview APK is suitable for device testing and internal distribution.

## 3. Web Capabilities

### Authentication

Implemented with Supabase Auth:

- Email and password registration.
- Email and password login.
- Persistent browser session.
- Password reset email flow.
- Profile loading.
- Logout.

### Dashboard

The web dashboard provides:

- Available-money and financial summary cards.
- Income and expense totals.
- Recent transactions.
- Transaction creation.
- Category creation and selection.
- Savings-goal creation.
- Income and expense charts.
- Spending trend chart.
- Expense category chart.
- Income source chart.
- Goal progress summary.

Important implementation note: some dashboard labels describe values as monthly even though the current summary query can provide lifetime totals. This should be corrected before treating monthly reporting as authoritative.

### Transactions

Implemented capabilities include:

- List transactions from Supabase.
- Create income transactions.
- Create expense transactions.
- Select categories.
- Create categories.
- Select transaction source such as M-Pesa, cash, bank, or other.
- Filter and review recent activity.

### Savings

Implemented capabilities include:

- Deposit money into savings.
- Withdraw money from savings.
- Spend directly from savings.
- Validate available savings balance before withdrawal or spending.
- Record savings activity separately from ordinary transactions.
- Display savings balance and statement information.

Savings is intentionally separate from goal balances.

### Goals

Implemented capabilities include:

- Create a savings goal.
- Contribute to an active goal.
- Withdraw from an active goal when permitted.
- Purchase from an active goal.
- Mark the goal as completed when the intended purchase is made.
- Transfer a completed goal's remaining balance to Available Money.
- Transfer a completed goal's remaining balance to another active goal.
- Prevent completed goals from receiving new contributions.
- Prevent completed goals from being edited or reopened.
- Display historical achievement independently from current balance.

Goal metrics are exposed by the `public.goal_metrics` view created in migration `007_goal_metrics.sql`.

The intended metric model is:

```text
achievement_percentage = total_contributions / target_amount * 100
completion_percentage  = 100 when status is COMPLETED, otherwise 0
current_balance        = contributions - purchases - transfers_out
                         + transfers_in - withdrawals
```

Therefore, an overfunded goal with target KSh 15,000, contributions of KSh 18,000, a KSh 12,000 purchase, and a KSh 6,000 transfer out must show:

```text
120% ACHIEVED
100% COMPLETE
KSh 0 REMAINING BALANCE
COMPLETED
```

The repository contains focused regression tests for this calculation in `scripts/goal-metrics.test.mjs`.

### Business

The web business area supports:

- Business creation.
- Product and inventory creation.
- Sales recording.
- Inventory quantity decrementing.
- Expense recording.
- Sales, expense, estimated profit, and stock-value summaries.

Risk: the sale workflow currently performs multiple client-side writes. A sale, inventory update, and sale-item insert should eventually be moved into one transactional server-side RPC to prevent partial writes.

### Chama

The web chama area supports:

- Chama creation.
- Owner membership initialization.
- Member reads.
- Contribution reads.
- Contribution recording.
- Member and contribution totals.

The membership and officer authorization rules are implemented through Supabase policies and should receive dedicated security tests.

### Reports

The web reports area supports:

- Date-range filtering.
- Transaction type filtering.
- Category filtering.
- Source filtering.
- Custom date ranges.
- Income and expense summaries.
- Charts and breakdowns.
- Filtered transaction table.
- CSV export.

### Settings

The web settings area supports:

- Profile name updates.
- Phone updates.
- Password updates.
- Logout.

## 4. Mobile Capabilities

### Authentication

Implemented:

- Email and password registration.
- Email and password login.
- Persistent session storage through AsyncStorage.
- Logout.
- Supabase configuration error handling.

Not implemented on mobile:

- Password reset flow.
- Full account/profile settings beyond the current profile screen.

### Home

The mobile home screen uses live Supabase data for:

- Recent transactions.
- Income total.
- Expense total.
- Available-money balance.
- Savings balance.

### Money

The mobile Money screen uses live Supabase data for:

- Transaction listing.
- Income and expense creation.
- Category selection and creation.
- Source selection.
- All, income, and expense filtering.

### Goals

The mobile Goals screen reads the shared `goal_metrics` view and displays:

- Goal name.
- Status.
- Target amount.
- Achievement percentage.
- Completion percentage.
- Current balance.

The mobile Goals screen is currently read-only. It does not yet provide goal creation, contribution, withdrawal, purchase, or remaining-balance transfer actions.

### Profile

The mobile profile screen supports live profile reads, profile updates, and logout.

### Chama, Business, and Reports

These mobile screens currently use static or mock data:

- Chama: mock groups, contributions, loans, repayment progress, and welfare data.
- Business: mock sales, expenses, profit, weekly charts, inventory, and alerts.
- Reports: mock personal, business, and chama data, mock period selectors, and static insights.

These screens are UI prototypes rather than connected production workflows.

## 5. Backend and Database

### Main tables

The schema includes:

- `profiles`
- `transactions`
- `categories`
- `financial_sources`
- `budgets`
- `savings_goals`
- `savings_transactions`
- `goal_transactions`
- `accounts`
- `businesses`
- `business_products`
- `business_sales`
- `business_sale_items`
- `business_expenses`
- `chamas`
- `chama_members`
- `chama_contributions`
- `notifications`

Additional migrations add goal allocation and transaction import structures.

### Authentication provisioning

The user-provisioning trigger creates a profile and default personal categories, financial sources, and accounts for a new user.

### Row-level security

Row-level security is enabled for the principal data tables. Personal records generally use ownership checks based on `auth.uid() = user_id`. Business and chama records use owner and membership relationships.

All security-sensitive policies should be tested with at least two separate users and unauthorized role combinations.

### Important RPCs

Personal finance and savings RPCs include:

- `get_dashboard_summary`
- `get_personal_finance_summary`
- `save_money`
- `withdraw_savings`
- `spend_from_savings`
- `transfer_between_accounts`

Goal RPCs include:

- `contribute_to_goal`
- `withdraw_from_goal`
- `refresh_goal_status`
- `spend_from_goal`
- `complete_goal_purchase`
- `transfer_completed_goal_to_available_money`
- `transfer_completed_goal_to_goal`

Most financial RPCs are `SECURITY DEFINER`, set `search_path = public`, and validate that the supplied user ID matches `auth.uid()`.

### Goal metrics view

Migration `007_goal_metrics.sql` creates `public.goal_metrics`. It aggregates `goal_transactions` and returns explicit fields for:

- `total_contributions`
- `total_goal_purchases`
- `total_transfers_in`
- `total_transfers_out`
- `total_withdrawals`
- `current_balance`
- `achievement_percentage`
- `completion_percentage`
- `status`

Transfer-in contributions are excluded from original historical contributions so that transferred funds do not inflate achievement and are not double-counted in current balance.

The view must be applied to the deployed Supabase project before either client can query it successfully.

## 6. Data Flow

### Web and mobile reads

```text
Supabase Auth
    -> user session
Client screen
    -> Supabase table query or RPC
Supabase RLS / security-definer function
    -> authorized data
Client state
    -> rendered cards, lists, charts, or metrics
```

### Goal flow

```text
Contribution RPC
    -> goal_transactions CONTRIBUTION
    -> savings_goals saved balance/status update

Purchase RPC
    -> transactions EXPENSE
    -> goal_transactions WITHDRAWAL with goal_spend metadata
    -> savings_goals COMPLETED

Completed-goal transfer RPC
    -> transactions TRANSFER
    -> goal_transactions WITHDRAWAL on source
    -> optional goal_transactions CONTRIBUTION on destination
    -> source current balance reduced while source stays COMPLETED

Goal metrics view
    -> historical contributions and movement totals
    -> achievement, completion, and current balance
    -> web and mobile UI
```

## 7. Build and Deployment

### Root commands

```powershell
npm install
npm run dev
npm run lint
npm run build
npm test
```

`npm run build` builds the web app and TypeScript-checks the mobile app. `npm test` runs the goal metrics regression tests.

### Web deployment

The web app can be deployed through Vercel or Render.

Required web environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The Vercel configuration rewrites routes to `index.html` for client-side routing. Render uses Vite preview on port `10000`.

### Mobile deployment

Mobile environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The current EAS profiles are:

- `preview`: Android APK for testing.
- `production`: currently empty and should be configured for Play Store AAB output.

Use the local Expo project directory when running EAS commands:

```powershell
cd packages/mobile
npm exec --yes --package=eas-cli -- eas build --platform android --profile preview
```

## 8. Pending Work

### Highest priority

1. Apply and verify all Supabase migrations, especially `007_goal_metrics.sql`, in the deployed project.
2. Run database-level goal tests against real Supabase data and RPCs.
3. Confirm RLS behavior for goal metrics and completed-goal transfers with separate test users.
4. Configure a production EAS profile that creates an Android AAB and set the correct Play Store release metadata.
5. Add mobile goal mutation actions so mobile can perform the same complete goal lifecycle as web.

### Product completeness

1. Replace mobile chama mock data with Supabase queries and mutations.
2. Replace mobile business mock data with Supabase queries and transactional business RPCs.
3. Replace mobile reports mock data with shared analytics queries.
4. Add mobile password reset and account settings.
5. Add goal activity history on web and mobile.
6. Add edit, archive, and delete policies for appropriate non-completed records.
7. Add budgets, recurring transactions, notifications, and import workflows where required by the product roadmap.

### Backend and operations

1. Implement Supabase Edge Functions for M-Pesa callbacks, payment verification, notifications, scheduled reporting, and other server-only operations.
2. Add atomic RPCs for business sales and inventory updates.
3. Add audit logging for sensitive financial mutations.
4. Add idempotency keys for payment and import operations.
5. Add monitoring, error tracking, and database backups verification.
6. Keep service-role credentials out of clients and repository history.

## 9. Recommendations

### Recommendation 1: Release personal finance first

The roadmap correctly prioritizes a secure personal-finance MVP. Treat web personal finance, savings, and goals as the first release surface. Keep business and chama features clearly marked as beta until mobile and backend workflows are connected and tested.

### Recommendation 2: Make the database the source of truth

Keep balance-changing operations in RPCs or transactional server-side functions. Client code should submit an intent and refresh authoritative results. Avoid calculating financial balances from independently loaded client lists.

### Recommendation 3: Add integration tests before public release

The current goal tests validate formulas in JavaScript. Add Supabase integration tests that create a disposable user and execute the real RPC sequence:

```text
contribute 18000
spend 12000
transfer out 6000
query goal_metrics
```

Assert `120`, `100`, `0`, and `COMPLETED` from the database response.

### Recommendation 4: Unify web and mobile contracts

Generate or centrally define typed data contracts for goal metrics, transactions, summaries, and business records. Both clients should consume the same field names and lifecycle states.

### Recommendation 5: Finish mobile parity deliberately

Do not present mock business, chama, or reports data as real account data. Either connect those screens or label them as preview functionality. The first mobile production release should prioritize reliable Home, Money, Goals, and Profile workflows.

### Recommendation 6: Improve release configuration

Before Play Store publication:

- Configure `production` in `eas.json` for AAB output.
- Set `cli.appVersionSource` to `remote` or the chosen versioning strategy.
- Add app icon, adaptive icon, splash screen, privacy policy URL, and store metadata.
- Test upgrade behavior from version `1.0.0`.
- Keep Android version codes increasing for every release.

### Recommendation 7: Harden financial security

Before handling real money or payment callbacks:

- Review every RLS policy with unauthorized-user tests.
- Review all `SECURITY DEFINER` functions.
- Restrict function execution privileges where appropriate.
- Validate amounts, ownership, statuses, and concurrency inside the database.
- Add audit records for corrections and administrative actions.
- Avoid displaying raw database errors to users.

### Recommendation 8: Fix reporting semantics

Separate lifetime, month-to-date, and selected-period queries. A card labeled monthly must use a date-bounded query, not a lifetime total returned under a monthly alias.

## 10. Definition of Done for a Public MVP

The personal-finance-first MVP should not be considered ready until:

- Web and mobile authentication work with production Supabase configuration.
- Transactions, savings, and goals use live data on both platforms.
- Goal creation and the full goal lifecycle work on both platforms.
- Goal metrics remain correct after purchases and transfers.
- RLS tests prove users cannot read or mutate another user's records.
- Database migrations are applied and recorded in the deployed project.
- Web production build passes.
- Mobile TypeScript checks and EAS build pass.
- Error states, empty states, loading states, and offline/network failures are handled.
- A production AAB is generated and tested on physical Android devices.
- Privacy, backups, monitoring, and rollback procedures are documented.
