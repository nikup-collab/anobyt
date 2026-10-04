# Anobyt coding tests: setup

## A. Deploy the backend (AWS, region ap-south-1)
1. Install AWS CLI + SAM CLI, then run `aws configure` (use an IAM user, never the root account).
2. `cd backend && sam build && sam deploy --guided --region ap-south-1`
   - Stack name: anobyt-tests
   - JwtSecret: any random 40+ character string (keep it private)
   - AllowedOrigin: https://anobyt.in
   - Accept the "Function URL has no auth" prompt (the app checks login tokens itself)
3. Copy the `ApiUrl` from the output.

## B. Connect the frontend
1. Copy `frontend/src/*` into your repo's `src/` (new folders: lib, data, pages).
2. Apply `App.routes.snippet.jsx`.
3. Local: create `.env` with `VITE_API_URL=<ApiUrl>`. Live: add the same variable in Netlify, then redeploy.

## C. Before the real test
- Lambda concurrency: AWS Console -> Service Quotas -> Lambda -> "Concurrent executions". If it says 10, request 100+. 300 simultaneous students will be throttled at 10.
- Billing -> Budgets: create a 1 USD budget alert.
- Run a dry run with 20-30 friends, and have everyone log in before the test starts.
