# StudyBuddy: deployment guide

## What is in this folder
- `server/index.js`: Node server. Keeps your AI key private, checks logins, enforces free daily limits, and handles Stripe payments.
- `public/index.html`: the StudyBuddy app. `shim.js` connects it to the server.
- `public/login.html`: sign-in with email link.
- `public/landing.html`: public home page with pricing.
- `supabase/schema.sql`: database tables and security rules.
- `legal/`: draft privacy policy and terms. These must be reviewed by a lawyer.

## Steps
1. **Supabase:** create a project. In the SQL editor, run `supabase/schema.sql`. Under Authentication, enable email sign-in and add your site URL.
2. **Anthropic:** create an API key at console.anthropic.com. Check current pricing and set a monthly spend limit.
3. **Stripe:** create a product with a monthly price. Copy its `price_` ID. Add a webhook pointing to `https://YOUR-DOMAIN/api/webhook` for `checkout.session.completed` and `customer.subscription.deleted`.
4. **Edit `public/login.html`:** replace `YOUR-PROJECT` and `YOUR-ANON-KEY` with your Supabase URL and anon key (these are safe in the browser).
5. **Configure:** copy `.env.example` to `.env` and fill in your values. Never commit `.env`.
6. **Run locally:** `npm install`, then `npm start`, then open http://localhost:3000.
7. **Deploy:** push to GitHub. On Render or Railway, create a Node web service with build command `npm install` and start command `npm start`, and add the same environment variables.
8. **Domain:** point your domain at the host and set `APP_URL` to it.
9. **Test:** sign up, ask a question, use a quiz, reach the free limit, pay with Stripe test mode, and confirm the plan changes to Pro.

## Before taking real students
- Parent consent is recorded (the server refuses AI use until a parent email is saved), but the parent's email is not verified. For stronger verification, send a confirmation email to the parent before activating the account.
- Lawyer review of the privacy policy and terms, and a data deletion process.
- A report button for wrong answers and a way to contact support.
- Monitoring of AI costs and errors.
- Accessibility and mobile testing with real students.

## Known limits
- Limit and consent messages use a browser alert. Replace them with proper in-app screens before launch.
- Chats and points are still stored in each browser. Move them into the database before launch if you need them across devices.
- Voice input needs a supported browser.
- Tutor videos are animated lessons with narration, not AI-generated video.

## Added in version 2

### Cloud save
Each student's data (chats, points, plans, books) is saved to Supabase and restored on a new device. Run `supabase/schema-v2.sql` once. Two devices editing at the same time: the most recent save wins.

### Teacher dashboard (`/teacher`)
1. A teacher signs up with the normal login. Set their role once in the Supabase SQL editor: `update profiles set role = 'teacher' where email = '...';`
2. The teacher creates a class and gets a code.
3. Students enter the code on the login screen after the parent consent step.
4. The dashboard shows points, tests, streaks and last activity. It never shows chats or photos.

Schools usually need a signed agreement and their own data-processing terms. Have a lawyer draft these.

### Payments
- **Stripe** (`/api/checkout` with `provider: "stripe"`). Webhook: `/api/webhook`.
- **Razorpay** (`provider: "razorpay"`). Create a monthly plan in the Razorpay dashboard and copy its `plan_` ID into `RAZORPAY_PLAN_ID`. Add a webhook at `https://YOUR-DOMAIN/api/webhook/razorpay` for the subscription events, and copy its secret into `RAZORPAY_WEBHOOK_SECRET`. Check the Razorpay docs for whether a return URL can be set on the subscription page.
- The `/pricing` page lets a logged-in student pick either option.

### Chapter packs (notes and sample papers)
Pre-made notes and papers are generated once, reviewed by a teacher, and then served to students. This costs far less than generating them on every request.

```
ANTHROPIC_API_KEY=... npm run gen:packs -- --class 5 --subject Maths
```

The script writes `content/packs/class-5-maths.json` with `"reviewed": false`. A teacher checks the content, then sets `"reviewed": true`. Students get the pack only after that. Until then, the app creates notes and papers live, as before.

Packs match chapters by name, ignoring capitals. If the chapter names differ, the app falls back to live AI.

Costs: each chapter takes about 3 AI calls. Run a few classes at a time and check your spending.

### Before launch (additional)
- Teacher review of every pack. AI-written questions and explanations can be wrong.
- A written data-processing agreement for schools.
- Secure the teacher role. Only trusted staff should be able to set it.

## Chapter lists (version 3)
Chapter names are no longer generated from AI memory. They come from `content/syllabus/`, which you fill from ncert.nic.in for the 2026-27 books. Until a file is verified, the app falls back to AI-suggested names and the pack generator skips that class and subject. See `content/syllabus/README.md`.
