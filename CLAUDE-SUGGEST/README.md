# Suggest

People comment on your projects. You pull the comments into Claude with `/comment` and decide
what gets built.

**Live:** https://suggest.apps.tas-ndc.kuhn-labs.com — anyone can use this one.

    node server.js          # http://localhost:4990  (also start.command)
    cf push                 # deploy

Storage picks itself: Postgres when the `suggest-db` service is bound (Cloud Foundry),
`data/db.json` when running on the laptop.

- **Add project** — name, link, one-line description.
- **They comment** — idea / bug / love it, with their name.
- **`/comment` in Claude** — lists the new ones, you say which are in, Claude marks them and builds them.
  Accepted shows "✓ building this" on the page, done shows "✓ built", rejected shows your reason.

One dependency (`pg`), no build step.

## API
| | |
|---|---|
| `GET /api/projects` | with commentCount / newCount |
| `POST /api/projects` | `{name, url, description}` |
| `GET /api/comments?status=new&projectId=` | status filter accepts a comma list |
| `POST /api/comments` | `{projectId, author, text, kind}` |
| `PATCH /api/comments/:id` | `{status: new\|accepted\|rejected\|done, note}` |
