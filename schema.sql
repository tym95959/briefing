NEON AIRPORT LOUNGE SURVEY

FILES
-----
survey.html
survey-admin.html
survey-results.html
api/questions.js
api/admin-question.js
api/save-survey.js
api/results.js
schema.sql
package.json

SETUP
-----
1. Create/open your Neon PostgreSQL database.
2. Run all SQL in schema.sql.
3. Put these files in your Vercel/GitHub project.
4. Run:
   npm install
5. In Vercel -> Project -> Settings -> Environment Variables, add:
   DATABASE_URL = your Neon connection string
   SURVEY_ADMIN_PASSWORD = your chosen admin password
6. Redeploy.

PAGES
-----
survey.html
Passenger survey. Questions are fetched dynamically from PostgreSQL.

survey-admin.html
Admin question manager:
- add
- edit
- activate/deactivate
- mark required/optional
- change display order
- delete

survey-results.html
Admin results:
- response count
- overall average
- question average
- NPS
- average recommendation score
- per-question statistics
- individual responses/comments
- date filter
- CSV export
- print

IMPORTANT
---------
Do not place DATABASE_URL or SURVEY_ADMIN_PASSWORD inside HTML files.
They stay in Vercel Environment Variables.

Change company name/address/document number in survey.html.
Change the hero image URL in survey.html if you want to use your own lounge photo.