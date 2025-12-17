-- Remove rate columns and bank account from employees
ALTER TABLE public.employees
DROP COLUMN IF EXISTS rate_per_day,
DROP COLUMN IF EXISTS rate_per_hour,
DROP COLUMN IF EXISTS bank_account_number;

-- Add assigned_hotel column to employees
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS assigned_hotel TEXT;

-- Clear existing locations to ensure clean state with user's specific list
DELETE FROM public.office_locations;

-- Insert new locations
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters, is_active)
VALUES
('City Of Dreams Manila', 'Aseana Avenue, Entertainment City, Parañaque, Metro Manila 1701', 14.524361292761883, 120.99193225197645, 1000, true),
('SMX', 'Seashell Lane, Mall of Asia Complex, Pasay, Metro Manila 1300', 14.53211228334931, 120.98170042038858, 1000, true),
('Hilton', '1 Newport Blvd, Newport City, Pasay, Metro Manila 1309', 14.518536764000176, 121.01927443407504, 1000, true),
('Lanson', 'Lot 2A, Seaside Blvd, Mall of Asia Complex, Pasay, Metro Manila 1300', 14.538102338347612, 120.97988919653429, 1000, true),
('Conrad', 'Seaside Blvd corner Coral Way, Mall of Asia Complex, Pasay, Metro Manila 1300', 14.531633520776792, 120.9800347110723, 1000, true),
('Okada', 'New Seaside Drive, Entertainment City, Parañaque, Metro Manila 1701', 14.515178429084413, 120.98150086579946, 1000, true),
('Taal Vista', 'Kilometer 60 Aguinaldo Highway, Tagaytay City, Cavite 4120', 14.095487332631969, 120.9346613509872, 1000, true),
('Pico De loro Jacana', 'Pico de Loro Cove, Barangay Papaya, Nasugbu, Batangas 4231', 14.193003637622716, 120.60057734829034, 1000, true),
('Pico De Loro Country Club', 'Pico de Loro Cove, Barangay Papaya, Nasugbu, Batangas 4231', 14.19340909544752, 120.60239116695163, 1000, true),
('Discovery PRIMEA', '6749 Ayala Avenue, Makati, Metro Manila 1226', 14.553795859138203, 121.02707174295, 1000, true),
('ADMIRAL', '2138 Roxas Boulevard, Malate, Manila, Metro Manila 1004', 14.565341731759196, 120.98524027535991, 1000, true),
('ARUGA', 'Waterfront Drive, Rockwell Center, Makati, Metro Manila 1210', 14.566346126201765, 121.03664279636773, 1000, true);
('Green Pasture', '31st Floor, Unit 3101, AIC, Burgundy Tower, ADB Ave, Ortigas Center, Pasig, Metro Manila', 14.589545534556084, 121.06119405688462, 1000, true);
