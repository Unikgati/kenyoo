import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import Button from '../components/ui/Button';
import DashboardCard from '../components/DashboardCard';
import { Product, Sale, DriverType, Location } from '../types';
import SaleConfirmationModal from '../components/SaleConfirmationModal';
import SuccessModal from '../components/SuccessModal';
import Switch from '../components/ui/Switch';
import Select from '../components/ui/Select';

const DriverDashboardScreen: React.FC = () => {
    const { user } = useAuth();
    const { products, sales, addSale, drivers, schedule, locations, updateDriver, updateScheduleForDriverToday } = useData();
    const { formatCurrency, settings } = useTheme();

    const [isShiftActive, setIsShiftActive] = useState(false);
    const [cart, setCart] = useState<Record<string, number>>({}); // ProductID -> Quantity
    
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [showSaleSuccessModal, setShowSaleSuccessModal] = useState(false);
    
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [showLocationSuccessModal, setShowLocationSuccessModal] = useState(false);

    const driverDetails = useMemo(() => drivers.find(d => d.userId === user?.id), [drivers, user]);
    const today = new Date();
    const todayString = today.toDateString();

    const todaysSales = useMemo(() => {
        if (!user || !driverDetails) return [];
        return sales.filter(s => s.driverId === driverDetails.id && new Date(s.timestamp).toDateString() === todayString)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [sales, user, driverDetails, todayString]);

    const currentAssignment = useMemo(() => {
        if (!driverDetails) return null;

        if (driverDetails.type === DriverType.DEDICATED) {
            const todaySchedule = schedule.find(item => item.driverId === driverDetails.id && new Date(item.date).toDateString() === todayString);
            return todaySchedule ? { id: todaySchedule.locationId, name: todaySchedule.locationName } : null;
        }
        if (driverDetails.type === DriverType.MITRA) {
            const assignedLocation = locations.find(l => l.id === driverDetails.location);
            return assignedLocation ? { id: assignedLocation.id, name: assignedLocation.name } : null;
        }
        return null;
    }, [driverDetails, schedule, locations, todayString]);

    const occupiedLocationsToday = useMemo(() => {
        const occupied = new Set<string>();
        const todayStr = new Date().toDateString();

        // Get locations from OTHER Mitra drivers
        drivers.forEach(d => {
            if (d.id !== driverDetails?.id && d.type === DriverType.MITRA && d.location) {
                occupied.add(d.location);
            }
        });

        // Get locations from OTHER Dedicated drivers' schedule for today
        schedule.forEach(s => {
            if (s.driverId !== driverDetails?.id && new Date(s.date).toDateString() === todayStr) {
                occupied.add(s.locationId);
            }
        });
        
        return occupied;
    }, [drivers, schedule, driverDetails]);

    const availableLocations = useMemo(() => {
        return locations
            .filter(l => !occupiedLocationsToday.has(l.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [locations, occupiedLocationsToday]);
    
    const upcomingSchedule = useMemo(() => {
        if (!driverDetails) return [];

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);

        return schedule
            .filter(item => {
                const itemDate = new Date(item.date);
                return item.driverId === driverDetails.id && itemDate >= startDate && itemDate < endDate;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [schedule, driverDetails]);

    const todaysRevenue = useMemo(() => todaysSales.reduce((sum, s) => sum + s.total, 0), [todaysSales]);
    const itemsSold = useMemo(() => todaysSales.reduce((sum, s) => sum + s.quantity, 0), [todaysSales]);
    
    const estimatedCommission = useMemo(() => {
        return todaysSales.reduce((commission, sale) => {
            const product = products.find(p => p.id === sale.productId);
            return commission + (product ? product.commission * sale.quantity : 0);
        }, 0);
    }, [todaysSales, products]);

    const cartItems = useMemo(() => {
        return Object.entries(cart)
            .map(([productId, quantity]) => {
                const product = products.find(p => p.id === productId);
                return { product, quantity };
            })
            .filter(item => item.product && item.quantity > 0);
    }, [cart, products]);

    const cartTotal = useMemo(() => {
        return cartItems.reduce((total, item) => {
            if (item.product) {
                return total + item.product.price * item.quantity;
            }
            return total;
        }, 0);
    }, [cartItems]);
    
    const handleCartQuantityChange = (productId: string, delta: number) => {
        setCart(prevCart => {
            const currentQuantity = prevCart[productId] || 0;
            const newQuantity = Math.max(0, currentQuantity + delta);

            if (newQuantity === 0) {
                const newCart = { ...prevCart };
                delete newCart[productId];
                return newCart;
            } else {
                return { ...prevCart, [productId]: newQuantity };
            }
        });
    };

    const handleRemoveFromCart = (productId: string) => {
        setCart(prevCart => {
            const newCart = { ...prevCart };
            delete newCart[productId];
            return newCart;
        });
    };
    
    const handleClearCart = () => setCart({});

    const handleProceedToPayment = () => {
        if (Object.keys(cart).length === 0) return;
        setIsSaleModalOpen(true);
    };

    const handleConfirmSale = (paymentMethod: 'cash' | 'qris') => {
        if (Object.keys(cart).length === 0 || !driverDetails || !currentAssignment) return;
    
        const currentLocationName = currentAssignment.name;

        Object.entries(cart).forEach(([productId, quantity]) => {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            const saleData: Omit<Sale, 'id' | 'timestamp'> = {
                driverId: driverDetails.id,
                driverName: driverDetails.name,
                productId: product.id,
                productName: product.name,
                quantity: Number(quantity),
                total: product.price * Number(quantity),
                location: currentLocationName,
                paymentMethod: paymentMethod,
            };
            addSale(saleData);
        });
        
        setCart({});
        setIsSaleModalOpen(false);
        setShowSaleSuccessModal(true);
        setTimeout(() => setShowSaleSuccessModal(false), 2000);
    };
    
     const handleLocationChangeConfirm = () => {
        if (!selectedLocationId || !driverDetails) return;

        if (driverDetails.type === DriverType.MITRA) {
            updateDriver({ ...driverDetails, location: selectedLocationId });
        } else if (driverDetails.type === DriverType.DEDICATED) {
            updateScheduleForDriverToday(driverDetails.id, selectedLocationId);
        }
        
        setIsEditingLocation(false);
        setShowLocationSuccessModal(true);
        setTimeout(() => setShowLocationSuccessModal(false), 2000);
    };


    return (
        <>
            <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <DashboardCard title="Today's Revenue" value={formatCurrency(todaysRevenue)} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.825-1.106-2.257 0-3.082C10.544 7.219 11.275 7 12 7c.725 0 1.45.22 2.003.659m-2.003 6v.008Z" /></svg>} />
                    {settings.showDriverItemsSold && (
                        <DashboardCard title="Items Sold" value={`${itemsSold}`} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>} />
                    )}
                    {settings.showDriverCommission && (
                         <DashboardCard title="Estimated Commission" value={formatCurrency(estimatedCommission)} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3.75a.75.75 0 0 0-.75.75v.75h18v-.75a.75.75 0 0 0-.75-.75h-16.5ZM2.25 8.25v9.75a.75.75 0 0 0 .75.75h16.5a.75.75 0 0 0 .75-.75V8.25a.75.75 0 0 0-.75-.75h-16.5a.75.75 0 0 0-.75.75Z" /></svg>} />
                    )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <CardTitle>Products</CardTitle>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2.5 w-2.5 rounded-full ${isShiftActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        <span className="text-sm font-medium text-secondary-foreground">{isShiftActive ? 'Shift Active' : 'Shift Inactive'}</span>
                                    </div>
                                    <Switch checked={isShiftActive} onChange={setIsShiftActive} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <fieldset disabled={!isShiftActive || !currentAssignment} className="disabled:opacity-50 disabled:cursor-not-allowed">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {products.filter(p => p.status === 'active').map((product) => {
                                        const quantityInCart = cart[product.id] || 0;
                                        return (
                                            <Card key={product.id} className="flex flex-col">
                                                <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover rounded-t-lg" />
                                                <CardHeader className="pt-4 pb-2 flex-grow">
                                                    <CardTitle className="text-base leading-snug" title={product.name}>{product.name}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="flex flex-col justify-end">
                                                    <p className="font-semibold text-lg text-accent mb-4">{formatCurrency(product.price)}</p>
                                                    <div className="flex items-center justify-center space-x-3">
                                                        <Button variant="secondary" size="sm" className="px-3" onClick={() => handleCartQuantityChange(product.id, -1)} disabled={quantityInCart <= 0}>-</Button>
                                                        <span className="text-lg font-bold w-12 text-center">{quantityInCart}</span>
                                                        <Button variant="secondary" size="sm" className="px-3" onClick={() => handleCartQuantityChange(product.id, 1)}>+</Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                    </div>
                                     {!currentAssignment && isShiftActive && (
                                        <div className="text-center py-10">
                                            <p className="font-semibold text-red-500">You are not assigned to any location today.</p>
                                            <p className="text-sm text-foreground/70">Please change your location in the "My Assignment" card before starting sales.</p>
                                        </div>
                                    )}
                                </fieldset>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="xl:col-span-2 space-y-6">
                         <Card>
                            <CardHeader>
                                <CardTitle>My Assignment</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isEditingLocation ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="location" className="block text-sm font-medium text-foreground/80 mb-1">Select Available Location</label>
                                            <Select id="location" value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)}>
                                                <option value="" disabled>Choose a new location...</option>
                                                {availableLocations.map(loc => (
                                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                ))}
                                            </Select>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="secondary" onClick={() => setIsEditingLocation(false)}>Cancel</Button>
                                            <Button onClick={handleLocationChangeConfirm} disabled={!selectedLocationId}>Confirm Change</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-accent flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                                            <span className="font-semibold text-lg">
                                                {currentAssignment ? currentAssignment.name : 'Unassigned'}
                                            </span>
                                        </div>
                                        {currentAssignment && (
                                            <Button variant="ghost" onClick={() => { setIsEditingLocation(true); setSelectedLocationId(currentAssignment?.id || '') }}>Change Location</Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                         <Card>
                            <CardHeader>
                                <CardTitle>Current Transaction</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {cartItems.length > 0 ? cartItems.map(({ product, quantity }) => product && (
                                        <div key={product.id} className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{product.name}</p>
                                                <p className="text-sm text-foreground/70">{formatCurrency(product.price)} x {quantity}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{formatCurrency(product.price * quantity)}</p>
                                                <button onClick={() => handleRemoveFromCart(product.id)} className="p-1 text-red-500 hover:text-red-700">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-center text-foreground/60 py-8">Cart is empty. Add products to start a sale.</p>
                                    )}
                                </div>
                            </CardContent>
                            {cartItems.length > 0 && (
                                <CardFooter className="flex-col items-stretch space-y-4 pt-4 mt-4 border-t">
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span>{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="secondary" onClick={handleClearCart}>Clear Cart</Button>
                                        <Button onClick={handleProceedToPayment} disabled={!isShiftActive || !currentAssignment}>Proceed to Payment</Button>
                                    </div>
                                </CardFooter>
                            )}
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Today's Sales Log</CardTitle></CardHeader>
                            <CardContent>
                                <div className="overflow-y-auto max-h-[400px] relative">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-secondary sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3">Product</th>
                                                <th className="px-4 py-3">Qty</th>
                                                <th className="px-4 py-3">Total</th>
                                                <th className="px-4 py-3">Payment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {todaysSales.length > 0 ? todaysSales.map((sale: Sale) => (
                                                <tr key={sale.id} className="border-b border-border">
                                                    <td className="px-4 py-3 font-medium">{sale.productName}</td>
                                                    <td className="px-4 py-3">{sale.quantity}</td>
                                                    <td className="px-4 py-3">{formatCurrency(sale.total)}</td>
                                                    <td className="px-4 py-3 capitalize">{sale.paymentMethod}</td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={4} className="text-center py-8 text-foreground/60">No sales recorded today.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                        {settings.showDriverSchedule && driverDetails?.type === DriverType.DEDICATED && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>My 7-Day Schedule</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {upcomingSchedule.length > 0 ? (
                                        <ul className="space-y-3">
                                            {upcomingSchedule.map(item => (
                                                <li key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-secondary/50 rounded-lg">
                                                    <div className="font-medium">
                                                        <span className="font-bold">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>, {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                                    </div>
                                                    <div className="text-foreground/80 flex items-center gap-2 mt-1 sm:mt-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                                                        {item.locationName}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-center text-foreground/60 py-4">No schedule has been generated for you for the upcoming week.</p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
            <SaleConfirmationModal
                isOpen={isSaleModalOpen}
                onClose={() => setIsSaleModalOpen(false)}
                cart={cart}
                products={products}
                onConfirm={handleConfirmSale}
            />
            <SuccessModal 
                isOpen={showSaleSuccessModal}
                title="Sale Recorded!"
                message="The transaction has been successfully saved."
            />
             <SuccessModal 
                isOpen={showLocationSuccessModal}
                title="Location Updated!"
                message="Your location has been successfully changed."
            />
        </>
    );
};

export default DriverDashboardScreen;