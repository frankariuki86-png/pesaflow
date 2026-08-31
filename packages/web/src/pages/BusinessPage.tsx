import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

type Business = { id: string; name: string; business_type: string | null; location: string | null };
type Product = { id: string; name: string; quantity: number; buying_price: number; selling_price: number; min_stock: number };
type Sale = { id: string; total_amount: number; sale_date: string };
type Expense = { id: string; category: string; amount: number; description: string | null; incurred_at: string };

const money = (value: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(value || 0);

export default function BusinessPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [businessForm, setBusinessForm] = useState({ name: "", business_type: "", location: "" });
  const [productForm, setProductForm] = useState({ name: "", buying_price: "", selling_price: "", quantity: "", min_stock: "" });
  const [saleForm, setSaleForm] = useState({ product_id: "", quantity: "1", payment_method: "CASH" });
  const [expenseForm, setExpenseForm] = useState({ category: "Other", amount: "", description: "" });

  const loadBusinesses = async () => {
    if (!user?.id) return;
    const { data, error: queryError } = await supabase.from("businesses").select("id, name, business_type, location").eq("owner_id", user.id).order("created_at", { ascending: false });
    if (queryError) { setError("Unable to load businesses."); return; }
    const loaded = (data as Business[]) ?? [];
    setBusinesses(loaded);
    setBusinessId((current) => current || loaded[0]?.id || "");
  };

  const loadBusinessData = async () => {
    if (!businessId) { setProducts([]); setSales([]); setExpenses([]); setLoading(false); return; }
    setLoading(true);
    const [productResult, saleResult, expenseResult] = await Promise.all([
      supabase.from("business_products").select("id, name, quantity, buying_price, selling_price, min_stock").eq("business_id", businessId).order("name"),
      supabase.from("business_sales").select("id, total_amount, sale_date").eq("business_id", businessId).order("sale_date", { ascending: false }).limit(100),
      supabase.from("business_expenses").select("id, category, amount, description, incurred_at").eq("business_id", businessId).order("incurred_at", { ascending: false }).limit(100),
    ]);
    if (productResult.error || saleResult.error || expenseResult.error) setError("Unable to load business records.");
    else { setProducts((productResult.data as Product[]) ?? []); setSales((saleResult.data as Sale[]) ?? []); setExpenses((expenseResult.data as Expense[]) ?? []); }
    setLoading(false);
  };

  useEffect(() => { void loadBusinesses(); }, [user?.id]);
  useEffect(() => { void loadBusinessData(); }, [businessId]);

  const totals = useMemo(() => {
    const salesTotal = sales.reduce((sum, item) => sum + Number(item.total_amount), 0);
    const expensesTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const stockValue = products.reduce((sum, item) => sum + Number(item.quantity) * Number(item.buying_price), 0);
    return { salesTotal, expensesTotal, stockValue, profit: salesTotal - expensesTotal };
  }, [sales, expenses, products]);

  const createBusiness = async (event: React.FormEvent) => {
    event.preventDefault(); if (!user?.id || !businessForm.name.trim()) return;
    setSaving(true); setError("");
    const { data, error: insertError } = await supabase.from("businesses").insert({ owner_id: user.id, ...businessForm }).select("id, name, business_type, location").single();
    if (insertError) setError("Unable to create business."); else { setBusinesses((current) => [data as Business, ...current]); setBusinessId(data.id); setBusinessForm({ name: "", business_type: "", location: "" }); setMessage("Business created successfully."); }
    setSaving(false);
  };

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault(); if (!businessId || !productForm.name.trim()) return;
    setSaving(true); setError("");
    const { error: insertError } = await supabase.from("business_products").insert({ business_id: businessId, name: productForm.name.trim(), buying_price: Number(productForm.buying_price) || 0, selling_price: Number(productForm.selling_price) || 0, quantity: Number(productForm.quantity) || 0, min_stock: Number(productForm.min_stock) || 0 });
    if (insertError) setError("Unable to add product."); else { setProductForm({ name: "", buying_price: "", selling_price: "", quantity: "", min_stock: "" }); setMessage("Product added successfully."); await loadBusinessData(); }
    setSaving(false);
  };

  const createSale = async (event: React.FormEvent) => {
    event.preventDefault();
    const product = products.find((item) => item.id === saleForm.product_id);
    const quantity = Number(saleForm.quantity);
    if (!businessId || !product || quantity <= 0 || quantity > product.quantity) { setError("Select a product with enough stock."); return; }
    setSaving(true); setError("");
    const total = quantity * Number(product.selling_price);
    const { data: sale, error: saleError } = await supabase.from("business_sales").insert({ business_id: businessId, sold_by: user?.id, total_amount: total, payment_method: saleForm.payment_method }).select("id").single();
    if (saleError) { setError("Unable to record sale."); setSaving(false); return; }
    const { error: itemError } = await supabase.from("business_sale_items").insert({ sale_id: sale.id, product_id: product.id, quantity, unit_price: product.selling_price, amount: total });
    const { error: stockError } = await supabase.from("business_products").update({ quantity: product.quantity - quantity }).eq("id", product.id);
    if (itemError || stockError) setError("Sale saved but inventory update failed."); else { setSaleForm({ product_id: "", quantity: "1", payment_method: "CASH" }); setMessage("Sale recorded successfully."); await loadBusinessData(); }
    setSaving(false);
  };

  const createExpense = async (event: React.FormEvent) => {
    event.preventDefault(); if (!businessId) return;
    const amount = Number(expenseForm.amount); if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a valid expense amount."); return; }
    setSaving(true); setError("");
    const { error: insertError } = await supabase.from("business_expenses").insert({ business_id: businessId, category: expenseForm.category || "Other", amount, description: expenseForm.description.trim() || null, payment_method: "CASH" });
    if (insertError) setError("Unable to record expense."); else { setExpenseForm({ category: "Other", amount: "", description: "" }); setMessage("Expense recorded successfully."); await loadBusinessData(); }
    setSaving(false);
  };

  if (businesses.length === 0) return <div className="p-6"><h1 className="text-3xl font-semibold text-navy">Business manager</h1><form onSubmit={createBusiness} className="mt-6 max-w-xl rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-xl font-semibold text-navy">Create your first business</h2><div className="mt-5 space-y-4"><input required value={businessForm.name} onChange={(event) => setBusinessForm({ ...businessForm, name: event.target.value })} placeholder="Business name" className="w-full rounded-2xl border border-border px-4 py-3" /><input value={businessForm.business_type} onChange={(event) => setBusinessForm({ ...businessForm, business_type: event.target.value })} placeholder="Business type" className="w-full rounded-2xl border border-border px-4 py-3" /><input value={businessForm.location} onChange={(event) => setBusinessForm({ ...businessForm, location: event.target.value })} placeholder="Location" className="w-full rounded-2xl border border-border px-4 py-3" /><button disabled={saving} className="rounded-2xl bg-emerald px-5 py-3 font-semibold text-white">{saving ? "Creating..." : "Create business"}</button>{error && <p className="text-sm text-red-600">{error}</p>}</div></form></div>;

  return <div className="p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Biashara</p><h1 className="mt-2 text-3xl font-semibold text-navy">Business manager</h1></div><select value={businessId} onChange={(event) => setBusinessId(event.target.value)} className="rounded-2xl border border-border bg-white px-4 py-3">{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></div>{error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}{loading ? <div className="rounded-3xl bg-white p-6 text-muted shadow-soft">Loading business data...</div> : <><div className="grid gap-6 md:grid-cols-4"><Metric label="Sales" value={money(totals.salesTotal)} color="text-emerald" /><Metric label="Expenses" value={money(totals.expensesTotal)} color="text-red-600" /><Metric label="Estimated profit" value={money(totals.profit)} color="text-sky-700" /><Metric label="Stock value" value={money(totals.stockValue)} color="text-amber-600" /></div><div className="mt-6 grid gap-6 lg:grid-cols-3"><form onSubmit={createProduct} className="rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-lg font-semibold text-navy">Add product</h2><div className="mt-4 space-y-3"><input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Product name" className="w-full rounded-xl border border-border px-3 py-2" /><input type="number" min="0" value={productForm.buying_price} onChange={(event) => setProductForm({ ...productForm, buying_price: event.target.value })} placeholder="Buying price" className="w-full rounded-xl border border-border px-3 py-2" /><input type="number" min="0" value={productForm.selling_price} onChange={(event) => setProductForm({ ...productForm, selling_price: event.target.value })} placeholder="Selling price" className="w-full rounded-xl border border-border px-3 py-2" /><input type="number" min="0" value={productForm.quantity} onChange={(event) => setProductForm({ ...productForm, quantity: event.target.value })} placeholder="Opening quantity" className="w-full rounded-xl border border-border px-3 py-2" /><input type="number" min="0" value={productForm.min_stock} onChange={(event) => setProductForm({ ...productForm, min_stock: event.target.value })} placeholder="Minimum stock" className="w-full rounded-xl border border-border px-3 py-2" /><button disabled={saving} className="w-full rounded-xl bg-emerald px-3 py-2 font-semibold text-white">Add product</button></div></form><form onSubmit={createSale} className="rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-lg font-semibold text-navy">Record sale</h2><div className="mt-4 space-y-3"><select required value={saleForm.product_id} onChange={(event) => setSaleForm({ ...saleForm, product_id: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.quantity})</option>)}</select><input required type="number" min="1" value={saleForm.quantity} onChange={(event) => setSaleForm({ ...saleForm, quantity: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2" /><select value={saleForm.payment_method} onChange={(event) => setSaleForm({ ...saleForm, payment_method: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2"><option>CASH</option><option>MPESA</option><option>BANK</option><option>CREDIT</option></select><button disabled={saving} className="w-full rounded-xl bg-emerald px-3 py-2 font-semibold text-white">Record sale</button></div></form><form onSubmit={createExpense} className="rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-lg font-semibold text-navy">Record expense</h2><div className="mt-4 space-y-3"><input value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} placeholder="Category" className="w-full rounded-xl border border-border px-3 py-2" /><input required type="number" min="0" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} placeholder="Amount" className="w-full rounded-xl border border-border px-3 py-2" /><input value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="Description" className="w-full rounded-xl border border-border px-3 py-2" /><button disabled={saving} className="w-full rounded-xl bg-emerald px-3 py-2 font-semibold text-white">Record expense</button></div></form></div><div className="mt-6 rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-lg font-semibold text-navy">Inventory</h2>{products.length === 0 ? <p className="mt-4 text-sm text-muted">No products yet.</p> : products.map((product) => <div key={product.id} className="flex items-center justify-between border-b border-border py-3"><div><p className="font-semibold text-text">{product.name}</p><p className="text-sm text-muted">{product.quantity} units • {money(product.buying_price)} cost each</p></div><span className={product.quantity <= product.min_stock ? "font-semibold text-red-600" : "font-semibold text-emerald"}>{product.quantity <= product.min_stock ? "Low stock" : "In stock"}</span></div>)}</div></>}</div>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) { return <div className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm text-muted">{label}</p><p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p></div>; }
