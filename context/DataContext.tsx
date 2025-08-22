



import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Product, Driver, Sale, Location, Schedule, DriverType, Payment, User, LocationCategory, CompanySettings } from '../types';
import { supabase } from '../lib/supabaseClient';
import { MOCK_SETTINGS } from '../lib/mockData';
import { useAuth } from './AuthContext';

interface DataContextType {
  products: Product[];
  drivers: Driver[];
  sales: Sale[];
  locations: Location[];
  schedule: Schedule[];
  payments: Payment[];
  settings: CompanySettings | null;
  loading: boolean;
  error: any;
  // CRUD operations
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addDriver: (driverData: Omit<Driver, 'id' | 'userId'>, userCredentials: { email: string; password: string }) => Promise<void>;
  updateDriver: (driver: Driver) => Promise<void>;
  addSale: (saleData: Omit<Sale, 'id' | 'timestamp'>) => Promise<void>;
  addLocation: (location: Omit<Location, 'id'>) => Promise<void>;
  updateLocation: (location: Location) => Promise<void>;
  deleteLocation: (locationId: string) => Promise<void>;
  generateSchedule: (options: { rotationInterval: number; excludedDays: number[] }) => Promise<void>;
  updateScheduleForDriverToday: (driverId: string, newLocationId: string) => Promise<void>;
  clearSchedule: () => Promise<void>;
  addPayment: (driverId: string, period: string, amount: number) => Promise<void>;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<void>;
  factoryReset: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session, user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchAllData = async () => {
    console.log("DataProvider: fetchAllData started. Session user:", session?.user?.email);
    setLoading(true);
    setError(null);

    try {
        // Step 1: Always fetch public settings, regardless of session
        const { data: settingsData, error: settingsError } = await supabase
            .from('settings')
            .select('*')
            .limit(1)
            .single();
        
        if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 = 0 rows is ok
            throw settingsError;
        }
        
        if (settingsData) {
            setSettings(settingsData as CompanySettings);
        } else {
            // If no settings exist in DB, insert the default ones
            const { data: newSettings, error: insertError } = await supabase.from('settings')
                .insert({ ...MOCK_SETTINGS, id: 'a8e9e3e3-1b1b-4b1b-8b1b-1b1b1b1b1b1b' })
                .select()
                .single();
            if (insertError) throw insertError;
            setSettings(newSettings as CompanySettings);
        }
        
        // Step 2: Fetch protected data only if a user is logged in
        if (session) {
            console.log("DataProvider: session exists, fetching protected data.");
            const [
                { data: productsData, error: productsError },
                { data: driversData, error: driversError },
                { data: salesData, error: salesError },
                { data: locationsData, error: locationsError },
                { data: scheduleData, error: scheduleError },
                { data: paymentsData, error: paymentsError },
            ] = await Promise.all([
                supabase.from('products').select('*').order('name', { ascending: true }),
                supabase.from('drivers').select('*').order('name', { ascending: true }),
                supabase.from('sales').select('*').order('timestamp', { ascending: false }),
                supabase.from('locations').select('*').order('name', { ascending: true }),
                supabase.from('schedule').select('*').order('date', { ascending: true }),
                supabase.from('payments').select('*').order('timestamp', { ascending: false }),
            ]);

            if (productsError) throw productsError;
            if (driversError) throw driversError;
            if (salesError) throw salesError;
            if (locationsError) throw locationsError;
            if (scheduleError) throw scheduleError;
            if (paymentsError) throw paymentsError;

            setProducts(productsData || []);
            setDrivers(driversData || []);
            setSales(salesData || []);
            setLocations(locationsData || []);
            setSchedule(scheduleData || []);
            setPayments(paymentsData || []);
        } else {
            // Step 3: If no session, clear all protected data
            console.log("DataProvider: no session, clearing protected data.");
            setProducts([]);
            setDrivers([]);
            setSales([]);
            setLocations([]);
            setSchedule([]);
            setPayments([]);
        }

    } catch (err: any) {
        setError(err);
        console.error("Error fetching data:", err.message || err);
         // Fallback to mock settings if the fetch fails, to prevent app crash
        if (!settings) {
            setSettings(MOCK_SETTINGS);
        }
    } finally {
        console.log("DataProvider: fetchAllData finished.");
        setLoading(false);
    }
  };
  
  useEffect(() => {
    // This effect ensures that data fetching only happens *after* the authentication
    // state is fully resolved. This prevents race conditions on page load.
    if (authLoading) {
      console.log("DataProvider: Auth is still loading, waiting.");
      return;
    }
    
    console.log("DataProvider: Auth has loaded, proceeding to fetch data.");
    fetchAllData();
    
  }, [user?.id, authLoading]); // Depend on user.id (stable) and authLoading


  // Products
  const addProduct = async (product: Omit<Product, 'id'>) => {
    const newProduct = { ...product, id: crypto.randomUUID() };
    const { data, error } = await supabase.from('products').insert(newProduct).select().single();
    if (error) throw error;
    if (data) setProducts(prev => [data, ...prev]);
  };
  const updateProduct = async (updatedProduct: Product) => {
    const { id, ...updateData } = updatedProduct;
    const { data, error } = await supabase.from('products').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    if (data) setProducts(prev => prev.map(p => p.id === data.id ? data : p));
  };
  const deleteProduct = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Drivers
  const addDriver = async (driverData: Omit<Driver, 'id' | 'userId'>, userCredentials: { email: string, password: string }) => {
    const { data: { user: newUser }, error: signUpError } = await supabase.auth.signUp({
        email: userCredentials.email,
        password: userCredentials.password,
        options: {
            data: { name: driverData.name, role: 'driver' }
        }
    });

    if (signUpError) throw new Error(`Failed to create user account: ${signUpError.message}`);
    if (!newUser) throw new Error('User account creation did not return a user.');
    
    const newDriverRecord = {
        id: crypto.randomUUID(),
        ...driverData,
        userId: newUser.id,
    };
    
    const { data: driverProfile, error: driverError } = await supabase.from('drivers').insert(newDriverRecord).select().single();
    if (driverError) {
      console.error('CRITICAL: User was created but profile creation failed. Manual cleanup needed for user ID:', newUser.id);
      throw new Error(`User created, but failed to create driver profile: ${driverError.message}`);
    }
    
    if (driverProfile) setDrivers(prev => [driverProfile, ...prev]);
  };
  const updateDriver = async (updatedDriver: Driver) => {
    const { id, name, type, contact, status, location } = updatedDriver;
    const updatePayload = { name, type, contact, status, location };
    const { data, error } = await supabase.from('drivers').update(updatePayload).eq('id', id).select().single();
    if (error) throw error;
    if (data) setDrivers(prev => prev.map(d => d.id === data.id ? data : d));
  };
  
  // Sales
  const addSale = async (saleData: Omit<Sale, 'id' | 'timestamp'>) => {
      const saleWithTimestamp = { ...saleData, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
      const { data, error } = await supabase.from('sales').insert(saleWithTimestamp).select().single();
      if (error) throw error;
      if (data) setSales(prev => [data, ...prev]);
  };

  // Locations
  const addLocation = async (location: Omit<Location, 'id'>) => {
    const newLocation = { ...location, id: crypto.randomUUID() };
    const { data, error } = await supabase.from('locations').insert(newLocation).select().single();
    if (error) throw error;
    if (data) setLocations(prev => [data, ...prev]);
  };
  const updateLocation = async (updatedLocation: Location) => {
    const { id, name, category } = updatedLocation;
    const updateData = { name, category }; // Only include fields that are part of the table.
    const { data, error } = await supabase.from('locations').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    if (data) setLocations(prev => prev.map(l => l.id === data.id ? data : l));
  };
  const deleteLocation = async (locationId: string) => {
    const { error } = await supabase.from('locations').delete().eq('id', locationId);
    if (error) throw error;
    setLocations(prev => prev.filter(l => l.id !== locationId));
  };

  // Schedule
  const generateSchedule = async (options: { rotationInterval: number; excludedDays: number[] }) => {
    const { rotationInterval, excludedDays } = options;
    const activeDedicatedDrivers = drivers.filter(d => d.status === 'active' && d.type === DriverType.DEDICATED);
    const availableLocations = locations.filter(l => l.category === LocationCategory.DAILY_ROTATION);
    if (activeDedicatedDrivers.length === 0 || availableLocations.length === 0) {
        alert("No active dedicated drivers or schedulable locations available.");
        return;
    }

    const newScheduleItems: Schedule[] = [];
    const driverLocationIndices = new Map<string, number>();
    activeDedicatedDrivers.forEach((driver, index) => driverLocationIndices.set(driver.id, index));
    
    let daysScheduled = 0;
    let currentDate = new Date();
    while (daysScheduled < 30) {
        const dayOfWeek = currentDate.getDay();
        if (!excludedDays.includes(dayOfWeek)) {
            activeDedicatedDrivers.forEach(driver => {
                const driverStartIndex = driverLocationIndices.get(driver.id)!;
                const locationDayIndex = Math.floor(daysScheduled / rotationInterval);
                const locationIndex = (driverStartIndex + locationDayIndex) % availableLocations.length;
                const location = availableLocations[locationIndex];
                newScheduleItems.push({
                    id: crypto.randomUUID(),
                    driverId: driver.id,
                    driverName: driver.name,
                    date: new Date(currentDate).toISOString().split('T')[0],
                    locationId: location.id,
                    locationName: location.name,
                });
            });
            daysScheduled++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const { error: deleteError } = await supabase.from('schedule').delete().in('driverId', activeDedicatedDrivers.map(d => d.id));
    if (deleteError) throw deleteError;

    const { data, error: insertError } = await supabase.from('schedule').insert(newScheduleItems).select();
    if (insertError) throw insertError;

     const { data: scheduleData, error: scheduleError } = await supabase.from('schedule').select('*').order('date', { ascending: true });
     if (scheduleError) throw scheduleError;
     setSchedule(scheduleData || []);
  };
  
  const updateScheduleForDriverToday = async (driverId: string, newLocationId: string) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const newLocation = locations.find(l => l.id === newLocationId);
    if (!newLocation) return;
    
    const { data, error } = await supabase.from('schedule')
        .update({ locationId: newLocation.id, locationName: newLocation.name })
        .eq('driverId', driverId)
        .eq('date', todayISO)
        .select()
        .single();

    if (error) throw error;
    if (data) {
        setSchedule(prev => prev.map(item => {
            const isMatch = item.driverId === driverId && item.date === todayISO;
            return isMatch ? data : item;
        }));
    }
  };

  const clearSchedule = async () => {
    const { error } = await supabase.from('schedule').delete().neq('id', '0'); // A way to delete all rows
    if (error) throw error;
    setSchedule([]);
  };

  // Payments (for Payroll)
  const addPayment = async (driverId: string, period: string, amount: number) => {
    const newPayment = { id: crypto.randomUUID(), driverId, period, amount, timestamp: new Date().toISOString() };
    const { data, error } = await supabase.from('payments').insert(newPayment).select().single();
    if (error) throw error;
    if (data) setPayments(prev => [data, ...prev]);
  };

  // Settings
  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    if (!settings) return;
    const { id, ...updateData } = newSettings;
    const { data, error } = await supabase.from('settings').update(updateData).eq('id', settings.id).select().single();
    if (error) throw error;
    if (data) setSettings(data as CompanySettings);
  };

  const factoryReset = async () => {
    console.warn("Factory Reset is not implemented for Supabase backend from the client. Please truncate tables in the Supabase dashboard.");
  };


  return (
    <DataContext.Provider value={{ 
        products, drivers, sales, locations, schedule, payments, settings,
        loading, error,
        addProduct, updateProduct, deleteProduct, 
        addDriver, updateDriver, 
        addSale, 
        addLocation, updateLocation, deleteLocation,
        generateSchedule, updateScheduleForDriverToday, clearSchedule,
        addPayment,
        updateSettings,
        factoryReset
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
