ALTER TABLE projects ADD COLUMN customer_consumption_mwh REAL;
ALTER TABLE projects ADD COLUMN tariff_group TEXT;
ALTER TABLE projects ADD COLUMN average_demand_kw REAL;
ALTER TABLE projects ADD COLUMN charger_power_kw REAL;
ALTER TABLE projects ADD COLUMN charger_unit_count INTEGER;
ALTER TABLE projects ADD COLUMN charging_time_hours REAL;
ALTER TABLE projects ADD COLUMN tariff_value_per_kwh REAL;
