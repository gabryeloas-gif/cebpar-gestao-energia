ALTER TABLE projects ADD COLUMN neoenergia_quote_code TEXT;

UPDATE projects
SET phase = CASE phase
  WHEN 'Projeto' THEN 'Desenvolvimento do projeto'
  WHEN 'Prospecção' THEN 'Prospecção e apresentação inicial'
  WHEN 'Contratos' THEN 'Contratação'
  WHEN 'O&M' THEN 'Operação e manutenção (O&M)'
  WHEN 'O&M / Faturamento' THEN 'Operação e manutenção (O&M)'
  ELSE phase
END
WHERE phase IN ('Projeto','Prospecção','Contratos','O&M','O&M / Faturamento');
