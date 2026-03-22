-- Apply once against an existing dev DB whose tables were created from an older stub schema.
-- Example: docker compose exec -T mysql mysql -ularo -plaro_secure_password laro_db < docker/mysql/patch-usage-schema.sql
--
-- If a statement fails with "Duplicate column", skip it. If usage_tracking shape is very wrong,
-- you can instead: DROP TABLE usage_tracking; then create it to match server/schema.ts.

ALTER TABLE usage_limits
  ADD COLUMN resourceType VARCHAR(128) NULL AFTER tier,
  ADD COLUMN monthlyLimit VARCHAR(32) NULL AFTER resourceType,
  ADD COLUMN description TEXT NULL AFTER monthlyLimit;

ALTER TABLE usage_tracking
  ADD COLUMN resourceType VARCHAR(128) NULL AFTER userId,
  ADD COLUMN quantity VARCHAR(32) NULL AFTER resourceType,
  ADD COLUMN baseCost VARCHAR(32) NULL AFTER quantity,
  ADD COLUMN billedCost VARCHAR(32) NULL AFTER baseCost,
  ADD COLUMN metadata TEXT NULL AFTER billedCost,
  ADD COLUMN caseId VARCHAR(64) NULL AFTER metadata,
  ADD COLUMN reportedToStripe TINYINT(1) NOT NULL DEFAULT 0 AFTER caseId,
  ADD COLUMN stripeUsageRecordId VARCHAR(128) NULL AFTER reportedToStripe,
  ADD COLUMN `timestamp` TIMESTAMP NULL AFTER stripeUsageRecordId;
