# Customer Login deployment

The customer login code is included in `backend/backend.js`.

## Important: deploy the backend

The error:

`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

means the browser received an HTML page from the API endpoint instead of JSON. This happens when the deployed backend is not the version containing `/api/customer/login` and `/api/customer/register`, or when the frontend `API_URL` points at a frontend/static site.

### Railway

Configure the Railway service that runs the API with:

- **Root Directory:** `backend`
- **Start Command:** `npm start`
- The backend must expose the generated Railway public domain.

Then keep this frontend setting in `frontend/js/main.js`:

```js
const API_URL = 'https://laptop-repair-management-production.up.railway.app/api';
```

Replace that domain only if your Railway backend has a different public domain.

After redeploying, these endpoints should return JSON:

- `GET /api/test`
- `POST /api/customer/register`
- `POST /api/customer/login`

The backend automatically creates the `CustomerAuth` table at startup if it does not exist.

## Frontend

Host the `frontend` directory on Netlify (or your static host). Do not point `API_URL` at the Netlify site; it must point to the Railway API.
