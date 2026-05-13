import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Utensils, 
  ShoppingBag, 
  Settings as SettingsIcon, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  LogOut, 
  Table as TableIcon,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CreditCard,
  Banknote,
  MoreVertical
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MenuItem, Category, Order, RestaurantTable } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'orders' | 'tables' | 'settings'>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [qrisPayload, setQrisPayload] = useState('');
  const [vtechApiKey, setVtechApiKey] = useState('');
  const [qrisFeeEnabled, setQrisFeeEnabled] = useState('y');
  const [qrisFeeType, setQrisFeeType] = useState('r');
  const [qrisFeeValue, setQrisFeeValue] = useState('250');

  useEffect(() => {
    fetchData();
    const orderSubscription = supabase
      .channel('orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*').order('display_order');
    const { data: itemData } = await supabase.from('menu_items').select('*').order('name');
    const { data: orderData } = await supabase.from('orders').select('*, table:restaurant_tables(*)').order('created_at', { ascending: false });
    const { data: tableData } = await supabase.from('restaurant_tables').select('*').order('table_number');
    const { data: settingsData } = await supabase.from('settings').select('*');

    if (catData) setCategories(catData);
    if (itemData) setMenuItems(itemData);
    if (orderData) setOrders(orderData);
    if (tableData) setTables(tableData);
    
    if (settingsData) {
      const qris = settingsData.find(s => s.key === 'qris_static_payload');
      const apiKey = settingsData.find(s => s.key === 'vtech_api_key');
      const feeEnabled = settingsData.find(s => s.key === 'qris_fee_enabled');
      const feeType = settingsData.find(s => s.key === 'qris_fee_type');
      const feeValue = settingsData.find(s => s.key === 'qris_fee_value');

      if (qris) setQrisPayload(qris.value || '');
      if (apiKey) setVtechApiKey(apiKey.value || '');
      if (feeEnabled) setQrisFeeEnabled(feeEnabled.value || 'y');
      if (feeType) setQrisFeeType(feeType.value || 'r');
      if (feeValue) setQrisFeeValue(feeValue.value || '250');
    }
    setLoading(false);
  }

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(orders.map(o => ({
      ID: o.id,
      Meja: o.table?.table_number,
      Total: o.total_amount,
      Status: o.status,
      Metode: o.payment_method,
      PaymentStatus: o.payment_status,
      Tanggal: format(new Date(o.created_at), 'yyyy-MM-dd HH:mm')
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `Sales_History_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    fetchData();
  };

  const updatePaymentStatus = async (orderId: string, payment_status: Order['payment_status']) => {
    await supabase.from('orders').update({ payment_status }).eq('id', orderId);
    fetchData();
  };

  const saveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const itemData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: parseFloat(formData.get('price') as string),
      category_id: formData.get('category_id') as string,
      is_available: formData.get('is_available') === 'on',
      stock_quantity: parseInt(formData.get('stock_quantity') as string),
      image_url: formData.get('image_url') as string
    };

    if (editingItem) {
      await supabase.from('menu_items').update(itemData).eq('id', editingItem.id);
    } else {
      await supabase.from('menu_items').insert(itemData);
    }

    setIsModalOpen(false);
    setEditingItem(null);
    fetchData();
  };

  const deleteMenuItem = async (id: string) => {
    if (confirm('Hapus menu ini?')) {
      await supabase.from('menu_items').delete().eq('id', id);
      fetchData();
    }
  };

  const saveQrisSettings = async () => {
    const updates = [
      { key: 'qris_static_payload', value: qrisPayload },
      { key: 'vtech_api_key', value: vtechApiKey },
      { key: 'qris_fee_enabled', value: qrisFeeEnabled },
      { key: 'qris_fee_type', value: qrisFeeType },
      { key: 'qris_fee_value', value: qrisFeeValue }
    ];

    for (const update of updates) {
      await supabase.from('settings').upsert(update, { onConflict: 'key' });
    }
    
    alert('QRIS Settings saved');
  };

  const statsData = orders
    .filter(o => o.status === 'completed' || o.payment_status === 'paid')
    .reduce((acc: any, order) => {
      const date = format(new Date(order.created_at), 'MM/dd');
      acc[date] = (acc[date] || 0) + order.total_amount;
      return acc;
    }, {});

  const chartData = Object.entries(statsData).map(([date, total]) => ({ date, total }));

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900 text-white flex flex-col fixed h-full z-50">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
            <Utensils className="w-6 h-6" />
          </div>
          <span className="text-xl font-black italic">Warunk Digital</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavItem active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<Utensils />} label="Menu" />
          <NavItem active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag />} label="Orders" />
          <NavItem active={activeTab === 'tables'} onClick={() => setActiveTab('tables')} icon={<TableIcon />} label="Tables" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon />} label="Settings" />
        </nav>

        <div className="p-4 mt-auto">
          <button className="flex items-center gap-3 text-neutral-400 hover:text-white transition-colors w-full p-3 px-4 rounded-xl hover:bg-white/5">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-neutral-900 capitalize">{activeTab}</h1>
            <p className="text-neutral-500">Welcome back, Admin</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 px-4 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-bold text-neutral-700">System Live</span>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Sales" value={formatCurrency(orders.filter(o => o.payment_status === 'paid').reduce((s,o) => s + parseFloat(o.total_amount as any), 0))} icon={<TrendingUp className="text-green-500" />} />
              <StatCard title="Active Orders" value={orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length.toString()} icon={<ShoppingBag className="text-orange-500" />} />
              <StatCard title="Occupied Tables" value={tables.filter(t => t.status === 'occupied').length.toString()} icon={<TableIcon className="text-blue-500" />} />
              <StatCard title="Total Items" value={menuItems.length.toString()} icon={<Utensils className="text-purple-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold">Revenue Overview</h3>
                  <Download className="w-5 h-5 text-neutral-300 cursor-pointer hover:text-black" onClick={exportToExcel} />
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#999'}} dx={-10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} />
                      <Line type="monotone" dataKey="total" stroke="#ea580c" strokeWidth={4} dot={{r: 6, fill: '#ea580c'}} activeDot={{r: 8}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
                <h3 className="text-xl font-bold mb-8">Recent Orders</h3>
                <div className="space-y-6">
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center font-bold text-neutral-500">
                           {o.table?.table_number}
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900">{formatCurrency(o.total_amount)}</p>
                          <p className="text-xs text-neutral-400">{format(new Date(o.created_at), 'HH:mm')}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider",
                        o.status === 'pending' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                      )}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="p-8 border-b border-neutral-50 flex items-center justify-between">
              <div className="relative w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <input 
                  className="w-full bg-neutral-50 border-0 p-4 pl-12 rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                className="bg-orange-600 text-white p-4 px-8 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-500 transition-all shadow-lg shadow-orange-100"
              >
                <Plus className="w-5 h-5" />
                Add New Menu
              </button>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 text-neutral-400 text-xs font-black uppercase tracking-wider">
                  <th className="p-8">Details</th>
                  <th className="p-8">Category</th>
                  <th className="p-8">Price</th>
                  <th className="p-8">Stock</th>
                  <th className="p-8">Status</th>
                  <th className="p-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="p-8">
                       <div className="flex items-center gap-4">
                         <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-50">
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                         </div>
                         <div>
                           <p className="font-bold text-neutral-900">{item.name}</p>
                           <p className="text-xs text-neutral-400 max-w-[200px] truncate">{item.description}</p>
                         </div>
                       </div>
                    </td>
                    <td className="p-8">
                       <span className="px-3 py-1 bg-neutral-100 rounded-full text-xs font-bold text-neutral-600">
                         {categories.find(c => c.id === item.category_id)?.name || 'Uncategorized'}
                       </span>
                    </td>
                    <td className="p-8 font-black text-neutral-900">{formatCurrency(item.price)}</td>
                    <td className="p-8 font-medium text-neutral-500">{item.stock_quantity}</td>
                    <td className="p-8">
                       <div className={cn(
                         "w-3 h-3 rounded-full",
                         item.is_available ? "bg-green-500 shadow-sm shadow-green-200" : "bg-red-500 shadow-sm shadow-red-200"
                       )}></div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-3 bg-white border border-neutral-100 rounded-xl shadow-sm hover:text-blue-600 transition-all"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteMenuItem(item.id)} className="p-3 bg-white border border-neutral-100 rounded-xl shadow-sm hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 flex items-center justify-between">
                   <div>
                     <p className="text-neutral-400 font-bold text-xs uppercase mb-1">Today's Orders</p>
                     <h2 className="text-2xl font-black">{orders.length}</h2>
                   </div>
                   <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600"><ShoppingBag /></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 flex items-center justify-between">
                   <div>
                     <p className="text-neutral-400 font-bold text-xs uppercase mb-1">Completed</p>
                     <h2 className="text-2xl font-black">{orders.filter(o => o.status === 'completed').length}</h2>
                   </div>
                   <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600"><CheckCircle2 /></div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 flex items-center justify-between">
                   <div>
                     <p className="text-neutral-400 font-bold text-xs uppercase mb-1">Pending Payment</p>
                     <h2 className="text-2xl font-black">{orders.filter(o => o.payment_status === 'unpaid').length}</h2>
                   </div>
                   <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600"><CreditCard /></div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
               <div className="p-6 border-b border-neutral-50 flex justify-between items-center bg-neutral-900 text-white">
                  <h3 className="font-bold flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-orange-500" />
                    Live Order Stream
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={exportToExcel} className="p-2 px-4 bg-white/10 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/20">
                        <Download className="w-4 h-4" /> Export Excel
                    </button>
                    <button className="p-2 px-4 bg-white/10 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/20">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                  </div>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-400 text-[10px] font-black uppercase tracking-widest">
                        <th className="p-6 px-10">Time / ID</th>
                        <th className="p-6">Table</th>
                        <th className="p-6">Amount</th>
                        <th className="p-6">Payment</th>
                        <th className="p-6">Status</th>
                        <th className="p-6 text-right px-10">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-neutral-50/50 transition-all">
                          <td className="p-6 px-10">
                             <div>
                               <p className="font-black text-neutral-900 text-sm">{format(new Date(order.created_at), 'HH:mm:ss')}</p>
                               <p className="text-[10px] font-mono text-neutral-300">{order.id.slice(0, 8)}...</p>
                             </div>
                          </td>
                          <td className="p-6">
                             <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-bold italic shadow-lg shadow-neutral-200">
                               {order.table?.table_number}
                             </div>
                          </td>
                          <td className="p-6"><span className="font-black text-neutral-900">{formatCurrency(order.total_amount)}</span></td>
                          <td className="p-6">
                             <div className="flex flex-col">
                               <div className="flex items-center gap-2">
                                 {order.payment_method === 'qris' ? <CreditCard className="w-4 h-4 text-purple-600" /> : <Banknote className="w-4 h-4 text-green-600" />}
                                 <span className="font-bold text-xs uppercase">{order.payment_method}</span>
                               </div>
                               <button 
                                onClick={() => updatePaymentStatus(order.id, order.payment_status === 'paid' ? 'unpaid' : 'paid')}
                                className={cn(
                                  "text-[10px] font-bold underline mt-1 text-left",
                                  order.payment_status === 'paid' ? "text-green-600" : "text-red-600"
                                )}>
                                  Mark as {order.payment_status === 'paid' ? 'Unpaid' : 'Paid'}
                                </button>
                             </div>
                          </td>
                          <td className="p-6">
                             <select 
                                value={order.status}
                                onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-wider p-2 rounded-xl border-0 shadow-sm",
                                  order.status === 'pending' ? "bg-orange-100 text-orange-600" : 
                                  order.status === 'confirmed' ? "bg-blue-100 text-blue-600" : 
                                  order.status === 'preparing' ? "bg-purple-100 text-purple-600" : 
                                  "bg-green-100 text-green-600"
                                )}
                             >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="preparing">Preparing</option>
                                <option value="served">Served</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                             </select>
                          </td>
                          <td className="p-6 text-right px-10">
                             <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"><MoreVertical className="w-5 h-5 text-neutral-300" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="max-w-4xl bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="p-8 border-b border-neutral-50 flex items-center justify-between bg-neutral-900 text-white">
               <div>
                 <h3 className="text-xl font-bold italic">Table Management</h3>
                 <p className="text-neutral-400 text-xs">Manage active tables and availability</p>
               </div>
               <button 
                onClick={async () => {
                  const num = prompt('Enter Table Number (e.g. 01):');
                  if (num) {
                    await supabase.from('restaurant_tables').insert({ table_number: num, status: 'available' });
                    fetchData();
                  }
                }}
                className="bg-orange-600 text-white p-3 px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-500 transition-all"
               >
                 <Plus className="w-5 h-5" /> Add Table
               </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-8">
              {tables.map(table => (
                <div key={table.id} className="bg-neutral-50 p-6 rounded-2xl border-2 border-neutral-100 flex flex-col items-center gap-4 relative group">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl",
                    table.status === 'available' ? "bg-white text-neutral-900" : "bg-orange-600 text-white"
                  )}>
                    {table.table_number}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm tracking-tight text-neutral-900">Table {table.table_number}</p>
                    <p className={cn(
                      "text-[10px] uppercase font-black mt-1",
                      table.status === 'available' ? "text-green-500" : "text-orange-500"
                    )}>{table.status}</p>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    <select 
                      value={table.status}
                      onChange={async (e) => {
                        await supabase.from('restaurant_tables').update({ status: e.target.value }).eq('id', table.id);
                        fetchData();
                      }}
                      className="flex-1 bg-white border border-neutral-200 text-[10px] font-bold p-2 rounded-lg"
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="reserved">Reserved</option>
                    </select>
                    <button 
                      onClick={async () => {
                        if (confirm('Delete this table?')) {
                          await supabase.from('restaurant_tables').delete().eq('id', table.id);
                          fetchData();
                        }
                      }}
                      className="p-2 bg-white border border-neutral-200 text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl bg-white p-10 rounded-[40px] shadow-sm border border-neutral-100">
             <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-orange-100 rounded-2xl text-orange-600">
                    <CreditCard className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase italic text-neutral-900 leading-none">QRIS Configuration</h2>
                    <p className="text-neutral-500 mt-2 font-medium">Ubah QRIS Statis Anda menjadi Dinamis secara otomatis.</p>
                </div>
             </div>
             
             <div className="space-y-8">
                <div className="bg-neutral-900 p-8 rounded-[32px] text-white">
                   <h4 className="font-bold flex items-center gap-2 mb-4 text-orange-400">
                     <Plus className="w-5 h-5" />
                     Cara Mendapatkan Payload QRIS
                   </h4>
                   <ol className="text-sm space-y-3 list-decimal list-inside text-neutral-300 font-medium leading-relaxed">
                     <li>Buka gambar QRIS Statis Anda di HP.</li>
                     <li>Scan menggunakan aplikasi "QR Scanner" atau "Google Lens".</li>
                     <li>Salin (Copy) teks hasil scan yang diawali dengan <code className="bg-white/10 p-1 px-2 rounded font-mono text-orange-300">000201...</code></li>
                     <li>Tempel (Paste) teks tersebut pada kolom di bawah ini.</li>
                   </ol>
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase mb-3 tracking-widest text-neutral-400">V-Tech API Key</label>
                   <input 
                      className="w-full border-2 border-neutral-100 p-4 rounded-2xl font-mono text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all outline-none bg-neutral-50"
                      placeholder="sk-..."
                      value={vtechApiKey}
                      onChange={e => setVtechApiKey(e.target.value)}
                   />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-3 tracking-widest text-neutral-400">Fee Status</label>
                    <select 
                      className="w-full border-2 border-neutral-100 p-4 rounded-2xl text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all outline-none bg-neutral-50 font-bold"
                      value={qrisFeeEnabled}
                      onChange={e => setQrisFeeEnabled(e.target.value)}
                    >
                      <option value="y">Enabled (Y)</option>
                      <option value="n">Disabled (N)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-3 tracking-widest text-neutral-400">Fee Type</label>
                    <select 
                      className="w-full border-2 border-neutral-100 p-4 rounded-2xl text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all outline-none bg-neutral-50 font-bold"
                      value={qrisFeeType}
                      onChange={e => setQrisFeeType(e.target.value)}
                    >
                      <option value="r">Flat (R)</option>
                      <option value="p">Percentage (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-3 tracking-widest text-neutral-400">Fee Value</label>
                    <input 
                      className="w-full border-2 border-neutral-100 p-4 rounded-2xl text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all outline-none bg-neutral-50 font-bold"
                      type="number"
                      value={qrisFeeValue}
                      onChange={e => setQrisFeeValue(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase mb-3 tracking-widest text-neutral-400">Merchant Static Payload</label>
                   <textarea 
                      className="w-full border-2 border-neutral-100 p-6 rounded-3xl h-40 font-mono text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all outline-none bg-neutral-50"
                      placeholder="Contoh: 00020101021126670014ID.LINKAJA.WWW01..."
                      value={qrisPayload}
                      onChange={e => setQrisPayload(e.target.value)}
                   />
                </div>
                
                <div className="bg-green-50 p-6 rounded-[24px] border border-green-100 flex items-start gap-4">
                   <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                   <div>
                       <p className="font-bold text-green-900 text-sm">Status: {qrisPayload ? 'Payload Terdeteksi' : 'Belum Ada Payload'}</p>
                       <p className="text-xs text-green-700/70 mt-1 uppercase font-black">
                         {qrisPayload && qrisPayload.startsWith('00') ? 'Format Valid (Mulai dengan 00)' : qrisPayload ? 'Format Mungkin Tidak Valid' : 'Silakan masukkan payload'}
                       </p>
                   </div>
                </div>

                <button 
                  onClick={saveQrisSettings}
                  className="w-full bg-orange-600 text-white py-5 rounded-[24px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-orange-100"
                >
                  Simpan Pengaturan QRIS
                </button>
             </div>
          </div>
        )}
      </main>

      {/* Menu Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-neutral-50 flex items-center justify-between">
                <h2 className="text-2xl font-black italic uppercase">
                    {editingItem ? 'Edit Item' : 'New Menu Item'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-neutral-100 rounded-2xl"><XCircle className="w-6 h-6" /></button>
              </div>

              <form onSubmit={saveMenuItem} className="flex-1 overflow-y-auto p-10 space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                        <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Name</label>
                        <input name="name" required defaultValue={editingItem?.name} className="w-full bg-neutral-50 border-0 p-4 rounded-2xl focus:ring-2 focus:ring-orange-500" />
                        </div>
                        <div>
                        <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Price (IDR)</label>
                        <input name="price" type="number" required defaultValue={editingItem?.price} className="w-full bg-neutral-50 border-0 p-4 rounded-2xl focus:ring-2 focus:ring-orange-500" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                        <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Category</label>
                        <select name="category_id" defaultValue={editingItem?.category_id} className="w-full bg-neutral-50 border-0 p-4 rounded-2xl focus:ring-2 focus:ring-orange-500">
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        </div>
                        <div>
                        <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Stock</label>
                        <input name="stock_quantity" type="number" defaultValue={editingItem?.stock_quantity} className="w-full bg-neutral-50 border-0 p-4 rounded-2xl focus:ring-2 focus:ring-orange-500" />
                        </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Image URL</label>
                    <input name="image_url" defaultValue={editingItem?.image_url} placeholder="https://..." className="w-full bg-neutral-50 border-0 p-4 rounded-2xl focus:ring-2 focus:ring-orange-500" />
                 </div>

                 <div>
                    <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Description</label>
                    <textarea name="description" defaultValue={editingItem?.description} className="w-full bg-neutral-50 border-0 p-4 rounded-2xl focus:ring-2 focus:ring-orange-500 h-24" />
                 </div>

                 <div className="flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl">
                    <input type="checkbox" name="is_available" defaultChecked={editingItem?.is_available ?? true} className="w-5 h-5 rounded-md border-neutral-300 text-orange-600 focus:ring-orange-500" />
                    <span className="text-sm font-bold">Item is currently available for purchase</span>
                 </div>

                 <button className="w-full bg-orange-600 text-white p-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-orange-100 mt-4">
                    Save Changes
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-4 rounded-2xl transition-all font-bold",
        active ? "bg-orange-600 text-white shadow-xl shadow-orange-600/20 translate-x-2" : "text-neutral-400 hover:text-white hover:bg-white/5"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">{title}</span>
        <div className="p-3 bg-neutral-50 rounded-xl">
           {icon}
        </div>
      </div>
      <h2 className="text-3xl font-black text-neutral-900 italic">{value}</h2>
      <div className="mt-4 flex items-center gap-2 text-green-500">
        <TrendingUp className="w-4 h-4" />
        <span className="text-xs font-bold font-mono">+12.5% from last month</span>
      </div>
    </div>
  );
}
