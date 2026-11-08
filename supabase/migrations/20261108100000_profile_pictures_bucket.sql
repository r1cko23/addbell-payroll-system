-- Profile pictures (docs/TODO.md item 19). Checked 2026-11-08.
--
-- Settings (staff) and the portal Info page (employees) upload a profile picture.
-- The bucket never existed in production, so every upload failed.
--
-- Public bucket: avatars show in headers and approval lists through a plain URL.
-- File names are random UUIDs and there is no select policy, so nobody can list the
-- bucket. Uploads and deletes run only in /api/profile-picture with the service role,
-- after it checks the staff login or the signed portal session. No write policies.
--
-- Rollback: delete from storage.objects where bucket_id = 'profile-pictures';
--           delete from storage.buckets where id = 'profile-pictures';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-pictures', 'profile-pictures', true, 204800,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
