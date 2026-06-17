# PrintVault API contract

Base path: `/api`. JSON unless noted. Auth via signed session cookie (`connect.sid`).
All non-public routes require an authenticated admin session (401 otherwise).
Public share routes live under `/api/share/:token` and never require login.

## Auth
- `POST /api/auth/login` — body `{ username, password }` → `200 { user:{username} }` / `401`. Rate-limited.
- `POST /api/auth/logout` → `200 { ok:true }`
- `GET  /api/auth/me` → `200 { user:{username} }` / `401`
- `POST /api/auth/change-password` — body `{ currentPassword, newPassword }` → `200 { ok:true }`

## Files
- `GET /api/files` — query: `search, tag, category, type, favorite(0|1), collection(id), sort(name|created_at|size|ext), order(asc|desc), page, pageSize` → `{ items:[File], total }`
- `POST /api/files` — `multipart/form-data`, field `files` (one or many). Optional fields applied to all: `category, tags`(comma list)`, description, printerNotes, materialNotes, profileNotes, sourceUrl`. Folder uploads: `relativePaths` (JSON array of per-file browser paths, aligned to `files` order), `autoTag` (`1|0` — add folder path segments as tags), `autoCollections` (`1|0` — create/append a collection per top-level folder). → `{ uploaded:[File], skipped:[], collectionsCreated:[{name,count}] }`
- `GET    /api/files/:id` → `File`
- `PATCH  /api/files/:id` — body any of `{ name, description, category, tags:[], printerNotes, materialNotes, profileNotes, sourceUrl }` → `File`
- `DELETE /api/files/:id` → `{ ok:true }`
- `POST   /api/files/:id/favorite` — body `{ favorite:bool }` → `File`
- `GET    /api/files/:id/download` — streams original file as attachment
- `GET    /api/files/:id/raw` — streams file inline (used by the STL/image previewer)
- `POST   /api/files/:id/thumbnail` — `multipart/form-data` field `thumb` (PNG); stores a model preview thumbnail
- `GET    /api/files/:id/thumbnail` — streams the PNG thumbnail (404 if none)
- `POST   /api/files/bulk/download` — body `{ ids:[] }` → streams `printvault-export.zip`
- `POST   /api/files/bulk/tag` — body `{ ids:[], addTags:[], removeTags:[], category? }` → `{ updated:n }`
- `POST   /api/files/bulk/delete` — body `{ ids:[] }` → `{ deleted:n }`

`File` = `{ id, name, originalName, ext, mime, size, description, category, tags:[], printerNotes, materialNotes, profileNotes, sourceUrl, favorite, thumb, createdAt, updatedAt }`

## Tags / categories
- `GET /api/tags` → `[{ name, count }]`
- `GET /api/categories` → `[{ name, count }]`

## Collections
- `GET    /api/collections` → `[{ id, name, description, fileCount, createdAt }]`
- `POST   /api/collections` — `{ name, description? }` → `Collection`
- `GET    /api/collections/:id` → `{ ...Collection, files:[File] }`
- `PATCH  /api/collections/:id` — `{ name?, description? }`
- `DELETE /api/collections/:id`
- `POST   /api/collections/:id/files` — `{ ids:[] }` add files
- `DELETE /api/collections/:id/files/:fileId` remove file
- `POST   /api/collections/:id/reorder` — `{ ids:[] }` set order
- `GET    /api/collections/:id/download` — streams ZIP

## Shares (admin-only management)
- `GET    /api/shares` → `[{ id, token, type, targetId, targetName, url, expiresAt, hasPassword, revoked, viewCount, createdAt }]`
- `POST   /api/shares` — `{ type:'file'|'collection', targetId, expiresAt?(ISO), password? }` → `{ ...share, url }`
- `DELETE /api/shares/:id` — revoke

## Public share access (no auth) — read-only
- `GET  /api/share/:token` → `{ type, name, requiresPassword, expired, revoked, authorized }` (metadata only)
- `POST /api/share/:token/auth` — `{ password }` → sets short-lived share grant cookie → `{ authorized:true }`
- `GET  /api/share/:token/files` → `[File]` (only files in the shared target; 401/403 if locked/expired/revoked)
- `GET  /api/share/:token/file/:fileId/download` — streams attachment
- `GET  /api/share/:token/file/:fileId/raw` — streams inline for preview
- `GET  /api/share/:token/file/:fileId/thumbnail` — streams the PNG thumbnail (404 if none)
- `GET  /api/share/:token/download` — ZIP of shared collection

## Settings / stats / export
- `GET   /api/settings` → `{ appName, allowedExtensions:[], maxUploadMb, baseUrl, port, storagePath, shareDefaultExpiryDays }`
- `PATCH /api/settings` — `{ appName?, shareDefaultExpiryDays? }` (read-only fields like port/storagePath come from env)
- `GET   /api/stats` → `{ fileCount, storageUsed, favorites, recentUploads:[File], recentShares:[Share], byType:[{ext,count}] }`
- `GET   /api/export?format=json|csv` — downloads metadata for all files
- `GET   /api/health` → `{ ok:true }`

Errors: `{ error: "message" }` with appropriate HTTP status (400/401/403/404/413/429/500).
