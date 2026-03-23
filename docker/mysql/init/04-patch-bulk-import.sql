-- Fix bulk_import_jobs table — add all columns used by bulkCaseImport.ts
ALTER TABLE bulk_import_jobs
  ADD COLUMN IF NOT EXISTS filename      varchar(256) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS totalRows     varchar(16)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS processedRows varchar(16)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS failedRows    varchar(16)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS errors        text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completedAt   timestamp    NULL DEFAULT NULL;

-- Also verify cases table has clientPhone and clientAddress (used in processBulkImport)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS clientPhone   varchar(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clientAddress text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metadata      text         DEFAULT NULL;

SELECT 'bulk_import_jobs patch complete' as status;