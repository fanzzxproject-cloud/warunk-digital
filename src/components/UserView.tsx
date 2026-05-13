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
import { cn, formatCurrency, generateDynamicQRIS } from '../lib/utils';
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
  const [dynamicQR, setDynamicQR] = useState('');
  const [isQRLoading, setIsQRLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (orderStatus?.payment_method === 'qris' && orderStatus?.payment_status === 'unpaid' && qrisBase) {
      getDynamicQR(qrisBase, Number(orderStatus.total_amount));
    }
  }, [orderStatus, qrisBase]);

  async function getDynamicQR(base: string, amount: number) {
    setIsQRLoading(true);
    try {
      const response = await fetch(`https://api.vtech.biz.id/qris/api.php?qris=${encodeURIComponent(base)}&nominal=${amount}`);
      const data = await response.text();
      if (data && data.trim().startsWith('00')) {
        setDynamicQR(data.trim());
      } else {
        setDynamicQR(generateDynamicQRIS(base, amount));
      }
    } catch (err) {
      console.error('API QRIS Error:', err);
      setDynamicQR(generateDynamicQRIS(base, amount));
    } finally {
      setIsQRLoading(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*').order('display_order');
    const { data: itemData } = await supabase.from('menu_items').select('*').order('name');
    const { data: tableData } = await supabase.from('restaurant_tables').select('*').order('table_number');
    const { data: qrisData } = await supabase.from('settings').select('value').eq('key', 'qris_static_payload').single();

    if (catData) setCategories(catData);
    if (itemData) setMenuItems(itemData);
    if (tableData) setTables(tableData);
    if (qrisData) setQrisBase(qrisData.value);
    setLoading(false);
  }

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);

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
    
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        table_id: selectedTable.id,
        total_amount: cartTotal,
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

    setOrderStatus(orderData);
    setCart([]);
    setIsCartOpen(false);
    alert(`Pesanan berhasil! ID: ${orderData.id}`);
  };

  const checkOrderById = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, table:restaurant_tables(*)')
      .eq('id', orderIdInput)
      .single();
    
    if (error) alert('Pesanan tidak ditemukan');
    else setOrderStatus(data);
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
               className="bg-white p-6 rounded-2xl w-full max-w-sm"
            >
              <h2 className="text-xl font-bold mb-4">Cek Status Pesanan</h2>
              <input 
                className="w-full border p-3 rounded-lg mb-4"
                placeholder="Masukkan ID Pesanan"
                value={orderIdInput}
                onChange={e => setOrderIdInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsCheckStatusOpen(false)}
                  className="flex-1 border p-3 rounded-lg"
                >
                  Batal
                </button>
                <button 
                  onClick={checkOrderById}
                  className="flex-1 bg-orange-600 text-white p-3 rounded-lg"
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
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6 text-center">
             <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-10 h-10 text-orange-600" />
             </div>
             <div>
                <p className="text-neutral-500 uppercase tracking-wider text-xs font-bold mb-1">Status Sekarang</p>
                <h2 className="text-3xl font-black text-neutral-900 capitalize italic">{orderStatus.status}</h2>
             </div>

             <div className="border-t pt-6 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Meja</span>
                  <span className="font-bold">{orderStatus.table?.table_number || selectedTable.table_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">ID Pesanan</span>
                  <span className="font-mono text-xs">{orderStatus.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Pembayaran</span>
                  <span className="font-bold uppercase">{orderStatus.payment_method} ({orderStatus.payment_status})</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>Total</span>
                  <span className="text-orange-600">{formatCurrency(orderStatus.total_amount)}</span>
                </div>
             </div>

              {orderStatus.payment_method === 'qris' && orderStatus.payment_status === 'unpaid' && (
               <div className="bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200">
                  <p className="text-xs font-bold mb-4">SILAKAN SCAN UNTUK MEMBAYAR</p>
                  <div className="bg-white p-4 inline-block rounded-xl shadow-inner relative">
                    {isQRLoading ? (
                      <div className="w-[200px] h-[200px] flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <QRCodeSVG 
                        value={dynamicQR || generateDynamicQRIS(qrisBase, Number(orderStatus.total_amount))} 
                        size={200} 
                      />
                    )}
                  </div>
                  <p className="mt-4 text-[10px] text-neutral-400 font-bold max-w-[200px] mx-auto break-all bg-white p-2 rounded border uppercase text-center">
                    {orderStatus.id.split('-')[0]} - {formatCurrency(Number(orderStatus.total_amount))}
                  </p>
                  <p className="mt-4 text-xs text-neutral-400 italic font-medium">Bisa bayar pakai OVO, Dana, GoPay, ShopeePay, dll.</p>
                  <p className="mt-2 text-[8px] text-neutral-300 uppercase font-black">Powered by Warunk Digital & V-Tech API</p>
               </div>
             )}
          </div>

          <button 
            onClick={() => setOrderStatus(null)}
            className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg"
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
              <p className="text-xs text-neutral-500 mt-1">Warunk Digital Menu</p>
            </div>
          </div>
          
          <div className="bg-neutral-100 p-1 rounded-full flex">
            <button className="px-4 py-2 bg-white rounded-full shadow-sm text-sm font-bold">Menu</button>
            <button 
              onClick={() => setIsCheckStatusOpen(true)}
              className="px-4 py-2 text-neutral-500 text-sm font-medium"
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
            className="w-full bg-white border-0 ring-1 ring-neutral-200 focus:ring-2 focus:ring-orange-500 py-4 pl-12 pr-4 rounded-2xl transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              "px-6 py-3 rounded-full font-bold whitespace-nowrap transition-all",
              activeCategory === 'all' ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "bg-white text-neutral-500 border border-neutral-200"
            )}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-6 py-3 rounded-full font-bold whitespace-nowrap transition-all",
                activeCategory === cat.id ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "bg-white text-neutral-500 border border-neutral-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group border border-neutral-100"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img 
                    src={item.image_url || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop`} 
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {!item.is_available && (
                    <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="text-white font-black text-lg py-2 px-6 border-4 border-white rotate-[-12deg]">HABIS</span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-neutral-900">{item.name}</h3>
                    <span className="text-orange-600 font-black">{formatCurrency(item.price)}</span>
                  </div>
                  <p className="text-neutral-500 text-sm mb-6 line-clamp-2 h-10">{item.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-400">
                      Stok: {item.stock_quantity > 0 ? item.stock_quantity : 'Habis'}
                    </div>
                    {item.is_available && item.stock_quantity > 0 ? (
                      <div className="flex items-center bg-neutral-100 rounded-full p-1">
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-neutral-600 shadow-sm disabled:opacity-50"
                          disabled={!cart.find(i => i.menuItem.id === item.id)}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-bold text-neutral-900">
                          {cart.find(i => i.menuItem.id === item.id)?.quantity || 0}
                        </span>
                        <button 
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button disabled className="bg-neutral-100 text-neutral-400 px-6 py-2 rounded-full text-sm font-bold">
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
              className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white rounded-t-[40px] z-[101] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-neutral-100">
                <div>
                  <h2 className="text-2xl font-black text-neutral-900 italic uppercase">Keranjang</h2>
                  <p className="text-neutral-400 text-sm font-medium">Meja {selectedTable.table_number}</p>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-3 bg-neutral-100 rounded-2xl hover:bg-neutral-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShoppingCart className="w-10 h-10 text-neutral-200" />
                        </div>
                        <p className="text-neutral-400 font-bold">Keranjang kosong</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.menuItem.id} className="flex items-center gap-4 group">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-100">
                            <img src={item.menuItem.image_url} alt={item.menuItem.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-neutral-900">{item.menuItem.name}</h4>
                            <p className="text-sm font-black text-orange-600">{formatCurrency(item.menuItem.price)}</p>
                          </div>
                          <div className="flex items-center bg-neutral-50 p-1 rounded-xl">
                            <button onClick={() => removeFromCart(item.menuItem.id)} className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center font-bold">{item.quantity}</span>
                            <button onClick={() => addToCart(item.menuItem)} className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 bg-neutral-50 border-t border-neutral-100 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-neutral-500 font-medium">
                        <span>Pilih Metode Pembayaran</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleCheckout('cash')}
                            className="p-4 bg-white border border-neutral-200 rounded-2xl font-bold flex flex-col items-center gap-2 hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm"
                        >
                            <UtensilsCrossed className="w-6 h-6" />
                            Bayar Tunai
                        </button>
                        <button 
                            onClick={() => handleCheckout('qris')}
                            className="p-4 bg-white border border-neutral-200 rounded-2xl font-bold flex flex-col items-center gap-2 hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm"
                        >
                            <CheckCircle2 className="w-6 h-6" />
                            Bayar QRIS
                        </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-neutral-900 p-6 rounded-[24px] text-white shadow-2xl">
                    <div>
                      <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mb-1">Total Pembayaran</p>
                      <h3 className="text-3xl font-black italic">{formatCurrency(cartTotal)}</h3>
                    </div>
                    <ChevronRight className="w-8 h-8 text-neutral-500" />
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
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-neutral-900 text-white p-4 rounded-[28px] shadow-2xl flex items-center justify-between hover:scale-105 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-orange-600 w-12 h-12 rounded-2xl flex items-center justify-center font-black italic">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </div>
              <div className="text-left leading-tight">
                <h4 className="font-bold">Lihat Keranjang</h4>
                <p className="text-xs text-neutral-400 font-medium tracking-wide italic">Selesaikan pesananmu</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-lg italic">{formatCurrency(cartTotal)}</p>
            </div>
          </button>
        </motion.div>
      )}
    </div>
  );
}
