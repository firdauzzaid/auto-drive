ALTER TABLE sales DROP CONSTRAINT sales_check2;

ALTER TABLE sales
  ADD CONSTRAINT sales_completed_at_check
  CHECK ((status IN ('completed', 'void')) = (completed_at IS NOT NULL));
