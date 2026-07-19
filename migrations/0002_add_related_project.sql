ALTER TABLE projects ADD COLUMN related_project_id TEXT REFERENCES projects(id);
CREATE INDEX idx_projects_related ON projects(related_project_id);
