import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, 
  ChevronRight, 
  Plus, 
  Minus, 
  X, 
  Clock, 
  CheckCircle2, 
  UtensilsCrossed,
  Search,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MenuItem, Category, CartItem, RestaurantTable, Order } from '../types';
import { cn, formatCurrency, generateDynamicQRIS, calculateQRISFee } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';

export default function UserView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatus, setOrderStatus] = useState<Order | null>(null);
  const [isCheckStatusOpen, setIsCheckStatusOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [qrisBase, setQrisBase] = useState('');
  const [vtechApiKey, setVtechApiKey] = useState('');
  const [qrisFeeSettings, setQrisFeeSettings] = useState({ enabled: 'n', type: 'r', value: '0' });
  const [dynamicQR, setDynamicQR] = useState('');
  const [isQRLoading, setIsQRLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (orderStatus?.payment_method === 'qris' && orderStatus?.payment_status === 'unpaid' && qrisBase) {
      setDynamicQR(''); // Clear old QR
      getDynamicQR(qrisBase, Number(orderStatus.total_amount));
    }
  }, [orderStatus?.id, qrisBase, vtechApiKey]);

  async function getDynamicQR(base: string, amount: number) {
    if (!base) return;
    setIsQRLoading(true);
    const roundedAmount = Math.floor(amount);
    
    // Validasi API Key
    if (!vtechApiKey || vtechApiKey.trim() === '') {
      console.warn('V-Tech API Key is not set, using local fallback generator');
      setDynamicQR(generateDynamicQRIS(base, roundedAmount));
      setIsQRLoading(false);
      return;
    }

    try {
      // Because we already added the fee to the 'amount' in handleCheckout,
      // we tell the API NOT to add another service fee (service_fee=n).
      const url = `https://api.vtech.biz.id/api/payment/qris-dynamic?apikey=${vtechApiKey.trim()}&qris=${encodeURIComponent(base.trim())}&amount=${roundedAmount}&service_fee=n&fee_type=${qrisFeeSettings.type}&fee_value=${qrisFeeSettings.value}`;
      
      console.log('Requesting Dynamic QRIS from V-Tech API:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const result = await response.json();
      console.log('V-Tech API Full Response:', result);
      
      // Handle both boolean and string "true" status
      const isSuccess = result.status === true || result.status === "true";

      if (isSuccess && result.data && result.data.dynamic_qris) {
        console.log('V-Tech API Success: Dynamic QR string received');
        setDynamicQR(result.data.dynamic_qris);
      } else {
        const errorMsg = result.message || 'API returned status fail';
        console.error('V-Tech API Failed Reason:', errorMsg);
        // Fallback to local generator
        const localQR = generateDynamicQRIS(base, roundedAmount);
        console.log('Using Local Fallback QR');
        setDynamicQR(localQR);
      }
    } catch (err) {
      console.error('Network Error calling QRIS API:', err);
      // Fallback lokal jika koneksi gagal (CORS atau Network)
      setDynamicQR(generateDynamicQRIS(base, roundedAmount));
    } finally {
      setIsQRLoading(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const { data: catData } = await supabase.from('categories').select('*').order('display_order');
      const { data: itemData } = await supabase.from('menu_items').select('*').order('name');
      const { data: tableData } = await supabase.from('restaurant_tables').select('*').order('table_number');
      const { data: settingsData } = await supabase.from('settings').select('*');

      if (catData) setCategories(catData);
      if (itemData) setMenuItems(itemData);
      if (tableData) setTables(tableData);
      
      if (settingsData) {
          const qris = settingsData.find(s => s.key === 'qris_static_payload');
          const apiKey = settingsData.find(s => s.key === 'vtech_api_key');
          const feeEnabled = settingsData.find(s => s.key === 'qris_fee_enabled');
          const feeType = settingsData.find(s => s.key === 'qris_fee_type');
          const feeValue = settingsData.find(s => s.key === 'qris_fee_value');

          if (qris) setQrisBase(qris.value || '');
          if (apiKey) setVtechApiKey(apiKey.value || '');
          if (feeEnabled || feeType || feeValue) {
              setQrisFeeSettings({
                  enabled: feeEnabled?.value || 'n',
                  type: feeType?.value || 'r',
                  value: feeValue?.value || '0'
              });
          }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const qrisFee = calculateQRISFee(cartTotal, qrisFeeSettings.enabled, qrisFeeSettings.type, qrisFeeSettings.value);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id);
      if (existing) {
        return prev.map(i => i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.menuItem.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.menuItem.id !== itemId);
    });
  };

  const handleCheckout = async (paymentMethod: 'cash' | 'qris') => {
    if (!selectedTable) return alert('Pilih meja terlebih dahulu');
    
    const finalAmount = paymentMethod === 'qris' ? cartTotal + qrisFee : cartTotal;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        table_id: selectedTable.id,
        total_amount: finalAmount,
        payment_method: paymentMethod,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) return alert('Gagal memproses pesanan');

    const orderItemsPayload = cart.map(item => ({
      order_id: orderData.id,
      menu_item_id: item.menuItem.id,
      quantity: item.quantity,
      price_at_order: item.menuItem.price
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload);

    if (itemsError) return alert('Gagal menyimpan item pesanan');

    // Reduce stock
    for (const item of cart) {
      const newStock = Math.max(0, item.menuItem.stock_quantity - item.quantity);
      await supabase
        .from('menu_items')
        .update({ stock_quantity: newStock })
        .eq('id', item.menuItem.id);
    }

    setOrderStatus(orderData);
    setCart([]);
    setIsCartOpen(false);
  };

  const checkOrderById = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, table:restaurant_tables(*)')
      .eq('id', orderIdInput)
      .single();
    
    if (error) alert('Pesanan tidak ditemukan');
    else {
      setOrderStatus(data);
      setIsCheckStatusOpen(false);
    }
  };

  if (!selectedTable) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <UtensilsCrossed className="w-16 h-16 text-orange-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Selamat Datang di Warunk Digital</h1>
          <p className="text-neutral-500 mb-8">Silakan pilih meja Anda untuk memulai pesanan.</p>
          
          <div className="grid grid-cols-3 gap-3">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={cn(
                  "py-4 rounded-xl border-2 transition-all font-bold",
                  table.status === 'available' 
                    ? "border-neutral-100 hover:border-orange-500 text-neutral-700" 
                    : "bg-neutral-100 border-neutral-100 text-neutral-400 cursor-not-allowed"
                )}
                disabled={table.status !== 'available'}
              >
                {table.table_number}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setIsCheckStatusOpen(true)}
            className="mt-8 text-orange-600 font-medium hover:underline flex items-center justify-center gap-2 mx-auto"
          >
            <Clock className="w-4 h-4" />
            Cek Status Pesanan
          </button>
        </motion.div>

        {isCheckStatusOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">Cek Status Pesanan</h2>
              <input 
                className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Masukkan ID Pesanan"
                value={orderIdInput}
                onChange={e => setOrderIdInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsCheckStatusOpen(false)}
                  className="flex-1 border p-3 rounded-lg font-bold"
                >
                  Batal
                </button>
                <button 
                  onClick={checkOrderById}
                  className="flex-1 bg-orange-600 text-white p-3 rounded-lg font-bold"
                >
                  Cek
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  if (orderStatus) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4">
        <header className="max-w-2xl mx-auto py-6 flex items-center justify-between">
          <button onClick={() => setOrderStatus(null)} className="p-2 bg-white rounded-full shadow-sm">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Status Pesanan</h1>
          <div className="w-10"></div>
        </header>

        <main className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm space-y-6 text-center">
             <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-10 h-10 text-orange-600" />
             </div>
             <div>
                <p className="text-neutral-500 uppercase tracking-wider text-xs font-bold mb-1">Status Sekarang</p>
                <h2 className="text-3xl font-black text-neutral-900 capitalize italic">{orderStatus.status}</h2>
             </div>

             <div className="border-t pt-6 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-medium">Meja</span>
                  <span className="font-bold">{orderStatus.table?.table_number || selectedTable.table_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-medium">ID Pesanan</span>
                  <span className="font-mono text-xs text-neutral-400">{orderStatus.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-medium">Metode Pembayaran</span>
                  <span className="font-bold uppercase text-orange-600">{orderStatus.payment_method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-medium">Status Pembayaran</span>
                  <span className={cn(
                    "font-bold uppercase",
                    orderStatus.payment_status === 'paid' ? "text-green-600" : "text-red-500"
                  )}>{orderStatus.payment_status}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>Total Bayar</span>
                  <span className="text-orange-600">{formatCurrency(Number(orderStatus.total_amount))}</span>
                </div>
             </div>

              {orderStatus.payment_method === 'qris' && orderStatus.payment_status === 'unpaid' && (
               <div className="bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200">
                  <p className="text-xs font-black mb-4 uppercase text-neutral-400">Silakan scan untuk membayar</p>
                  <div className="bg-white p-6 inline-block rounded-3xl shadow-inner relative">
                    {isQRLoading ? (
                      <div className="w-[200px] h-[200px] flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <>
                        <QRCodeSVG 
                          value={dynamicQR || generateDynamicQRIS(qrisBase, Number(orderStatus.total_amount))} 
                          size={200} 
                          level="H"
                        />
                        {!dynamicQR && !isQRLoading && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-[8px] text-white px-2 py-0.5 rounded-full whitespace-nowrap opacity-50">
                            Local Generator Mode
                          </div>
                        )}
                        {dynamicQR && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-green-600 text-[8px] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                            V-Tech API Active
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-4 bg-white p-3 rounded-xl border border-neutral-200">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1">Sudah termasuk Admin/Fee</p>
                    <p className="font-black text-lg text-neutral-900">{formatCurrency(Number(orderStatus.total_amount))}</p>
                  </div>
                  <p className="mt-4 text-xs text-neutral-500 italic font-medium leading-relaxed">
                    Bisa bayar pakai OVO, Dana, GoPay, ShopeePay, atau aplikasi Bank. Pesanan akan diproses otomatis setelah pembayaran terkonfirmasi.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 grayscale brightness-110 opacity-50">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="h-4" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/39/GPN_Logo.svg" alt="GPN" className="h-4" />
                  </div>
               </div>
             )}
          </div>

          <button 
            onClick={() => setOrderStatus(null)}
            className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-100 hover:scale-[1.01] active:scale-95 transition-all"
          >
            Kembali ke Menu
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-32">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-40 px-4 py-6 border-b border-neutral-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Meja {selectedTable.table_number}</h1>
              <p className="text-xs text-neutral-500 mt-1 uppercase font-black tracking-widest">Warunk Digital</p>
            </div>
          </div>
          
          <div className="bg-neutral-100 p-1 rounded-full flex">
            <button className="px-5 py-2 bg-white rounded-full shadow-sm text-sm font-bold">Menu</button>
            <button 
              onClick={() => setIsCheckStatusOpen(true)}
              className="px-5 py-2 text-neutral-500 text-sm font-bold hover:text-neutral-900 transition-colors"
            >
              Status
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari menu favoritmu..." 
            className="w-full bg-white border-0 ring-1 ring-neutral-200 focus:ring-2 focus:ring-orange-500 py-5 pl-12 pr-4 rounded-3xl transition-all shadow-sm outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              "px-8 py-3 rounded-full font-bold whitespace-nowrap transition-all uppercase text-sm tracking-widest",
              activeCategory === 'all' ? "bg-orange-600 text-white shadow-lg shadow-orange-200 border-orange-600" : "bg-white text-neutral-500 border border-neutral-200"
            )}
          >
            Semua
          </button>
          {Array.from(new Map(categories.map(cat => [cat.name, cat])).values()).map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-8 py-3 rounded-full font-bold whitespace-nowrap transition-all uppercase text-sm tracking-widest",
                activeCategory === cat.id ? "bg-orange-600 text-white shadow-lg shadow-orange-200 border-orange-600" : "bg-white text-neutral-500 border border-neutral-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          <AnimatePresence mode="popLayout">
            {filteredItems.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[40px] overflow-hidden shadow-sm hover:shadow-xl transition-all group border border-neutral-100 flex flex-col h-full"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img 
                    src={item.image_url || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop`} 
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  {!item.is_available && (
                    <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[4px] flex items-center justify-center">
                      <span className="text-white font-black text-2xl py-3 px-8 border-4 border-white -rotate-12 uppercase tracking-tighter">HABIS</span>
                    </div>
                  )}
                  <div className="absolute bottom-4 right-4">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl font-black text-orange-600 italic">
                      {formatCurrency(Number(item.price))}
                    </div>
                  </div>
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="font-bold text-xl text-neutral-900 mb-2 leading-tight">{item.name}</h3>
                  <p className="text-neutral-500 text-sm mb-8 line-clamp-3 leading-relaxed flex-1">{item.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1">Tersedia</span>
                        <span className="text-sm font-bold text-neutral-900">{item.stock_quantity > 0 ? `${item.stock_quantity} Porsi` : 'Habis'}</span>
                    </div>
                    {item.is_available && item.stock_quantity > 0 ? (
                      <div className="flex items-center bg-neutral-50 rounded-2xl p-1 shadow-inner border border-neutral-100">
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors disabled:opacity-30"
                          disabled={!cart.find(i => i.menuItem.id === item.id)}
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="w-12 text-center font-black text-lg text-neutral-900 italic">
                          {cart.find(i => i.menuItem.id === item.id)?.quantity || 0}
                        </span>
                        <button 
                          onClick={() => addToCart(item)}
                          className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xl shadow-orange-200 hover:bg-orange-500 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button disabled className="bg-neutral-100 text-neutral-400 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest">
                        Unavailable
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white rounded-t-[50px] z-[101] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.2)]"
            >
              <div className="p-10 pb-6 flex items-center justify-between border-b border-neutral-100">
                <div>
                  <h2 className="text-3xl font-black text-neutral-900 italic uppercase leading-none">Pesanan</h2>
                  <p className="text-neutral-400 text-sm font-bold mt-2 uppercase tracking-widest">Meja {selectedTable.table_number}</p>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="w-14 h-14 bg-neutral-100 rounded-3xl flex items-center justify-center hover:bg-neutral-200 transition-all hover:scale-90"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                {cart.length === 0 ? (
                    <div className="text-center py-24 opacity-20">
                        <div className="w-32 h-32 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-dashed border-neutral-200">
                            <ShoppingCart className="w-16 h-16 text-neutral-400" />
                        </div>
                        <p className="text-2xl font-black italic uppercase tracking-tighter">Keranjang Kosong</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.menuItem.id} className="flex items-center gap-6 group">
                          <div className="w-24 h-24 rounded-3xl overflow-hidden bg-neutral-100 shadow-inner">
                            <img src={item.menuItem.image_url} alt={item.menuItem.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-neutral-900 text-lg leading-tight mb-1">{item.menuItem.name}</h4>
                            <p className="font-black text-orange-600 italic">{formatCurrency(Number(item.menuItem.price))}</p>
                          </div>
                          <div className="flex items-center bg-neutral-50 p-1.5 rounded-2xl border border-neutral-100 shadow-inner">
                            <button onClick={() => removeFromCart(item.menuItem.id)} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm hover:scale-90 transition-transform">
                                <Minus className="w-5 h-5" />
                            </button>
                            <span className="w-12 text-center font-black text-lg italic">{item.quantity}</span>
                            <button onClick={() => addToCart(item.menuItem)} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm hover:scale-90 transition-transform">
                                <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-10 bg-neutral-950 text-white rounded-t-[40px] space-y-8">
                  <div className="space-y-4">
                    <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] text-center">Pilih Metode Pembayaran</p>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleCheckout('cash')}
                            className="p-6 bg-white/5 border border-white/10 rounded-[28px] font-black flex flex-col items-center gap-2 hover:bg-white/10 hover:border-orange-500 transition-all uppercase tracking-widest text-[10px]"
                        >
                            <UtensilsCrossed className="w-6 h-6 text-orange-600 mb-1" />
                            Bayar Tunai
                        </button>
                        <button 
                            onClick={() => handleCheckout('qris')}
                            className="p-6 bg-white/5 border border-white/10 rounded-[28px] font-black flex flex-col items-center gap-2 hover:bg-white/10 hover:border-orange-500 transition-all uppercase tracking-widest text-[10px]"
                        >
                            <CheckCircle2 className="w-6 h-6 text-orange-600 mb-1" />
                            Bayar QRIS
                        </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">Total Pesanan</p>
                          <h3 className="text-4xl font-black italic tracking-tighter">
                            {formatCurrency(cartTotal)}
                          </h3>
                        </div>
                        {qrisFee > 0 && (
                          <div className="text-right pb-1">
                             <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest leading-none">+ Admin QRIS</p>
                             <p className="text-orange-600 font-bold text-sm italic">{formatCurrency(qrisFee)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      {cart.length > 0 && !isCartOpen && (
        <motion.div 
          initial={{ y: 200 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-4"
        >
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full max-w-sm bg-neutral-900 text-white p-5 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-between hover:scale-[1.02] active:scale-95 transition-all outline-none"
          >
            <div className="flex items-center gap-5">
              <div className="bg-orange-600 w-14 h-14 rounded-[22px] flex items-center justify-center font-black text-2xl italic shadow-lg shadow-orange-600/20 translate-x-[-10px]">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </div>
              <div className="text-left leading-none">
                <h4 className="font-black italic uppercase tracking-wider text-sm">Lihat Pesanan</h4>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1.5 italic">Siap untuk checkout?</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-2xl italic italic tracking-tighter text-orange-500">{formatCurrency(cartTotal)}</p>
            </div>
          </button>
        </motion.div>
      )}

      {isCheckStatusOpen && (
          <div className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white p-8 rounded-[40px] w-full max-w-md shadow-2xl"
            >
              <div className="w-20 h-20 bg-orange-100 rounded-[28px] flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-orange-600" />
              </div>
              <h2 className="text-2xl font-black italic uppercase tracking-tight mb-2 text-neutral-900">Cek Status Pesanan</h2>
              <p className="text-neutral-500 text-sm font-medium mb-8">Masukkan ID Pesanan yang Anda terima sebelumnya.</p>
              
              <input 
                className="w-full bg-neutral-50 border-2 border-neutral-100 p-5 rounded-2xl mb-8 focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all font-mono text-sm"
                placeholder="cth: 550e8400-e29b-..."
                value={orderIdInput}
                onChange={e => setOrderIdInput(e.target.value)}
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsCheckStatusOpen(false)}
                  className="flex-1 bg-neutral-100 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={checkOrderById}
                  className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all"
                >
                  Lanjut
                </button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
}
