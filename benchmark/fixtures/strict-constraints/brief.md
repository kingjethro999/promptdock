# Refine this existing instruction

Audit the current upload flow and fix the file validation bug in the existing implementation. Keep the upload provider and public API unchanged. Do not add video upload, do not store uploaded file contents in the database, and do not change existing file URLs. Use the current test framework, add a regression case for executable content, then run focused tests and lint. Work in the existing repository and implement the fix directly.
