                                                                                             # Frontend (React)

## Run
                                                                    
```bash
cd frontend
npm install
npm start
```

App URL: `http://localhost:3000`

## Build

```bash
npm run build
```

## Environment

Create `.env` in `frontend/`:

```env
REACT_APP_API_BASE_URL=http://127.0.0.1:8000
```

## Main App Entry

- `src/App.js`
- `src/config/sidebar.js`

## Key Pages

- `src/pages/login/` OTP + token flow
- `src/pages/enquiries/Enquiries.jsx` Local/Export enquiry form
- `src/pages/sales-pipeline/` Deal pipeline + drag/drop
- `src/pages/accounts/` Account master
- `src/pages/contacts/` Contact master

## Important API Integrations

- Auth: `src/pages/login/api/auth.js`
- Enquiry sync: `src/pages/enquiries/Enquiries.jsx`
- Deals: `src/pages/sales-pipeline/api/deals.js`
- Accounts: `src/pages/accounts/api/accounts.js`
- Contacts: `src/pages/contacts/api/contacts.js`

## New Master Data Usage

Enquiry page loads backend material masters:
- `GET /api/v1/enquiries/masters/grades`
- `GET /api/v1/enquiries/masters/tolerances`

Local/Export grade dropdowns and local tolerance dropdown now come from backend.
