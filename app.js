const $=id=>document.getElementById(id);
let products=[], cart=[], category="Todos";
const waNumbers=["51992713564","51986996848"];
const moneylessVariants=p=>p.variants?.length?p.variants:[];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function load(){try{const r=await fetch("/api/products");products=await r.json();render();}catch{$("products").innerHTML="<p>No se pudo cargar el catálogo. Intenta nuevamente.</p>";}}
function render(){
 const cats=["Todos",...new Set(products.map(p=>p.category).filter(Boolean))];
 $("categories").innerHTML=cats.map(c=>`<button class="chip ${c===category?"selected":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
 document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{category=b.dataset.cat;render();});
 const q=$("search").value.toLowerCase();
 const list=products.filter(p=>(category==="Todos"||p.category===category)&&(`${p.name} ${p.description} ${p.category}`).toLowerCase().includes(q));
 $("products").innerHTML=list.length?list.map(p=>`<article class="product"><div>${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:`<div class="placeholder">Fotografía próximamente</div>`}</div><div class="productInfo"><small>${esc(p.category)}</small><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>${moneylessVariants(p).length?`<label>Medida / presentación<select id="v-${p.id}">${p.variants.map(v=>`<option>${esc(v)}</option>`).join("")}</select></label>`:""}<button class="primary" data-add="${p.id}">Agregar al carrito</button></div></article>`).join(""):"<p>No hay productos que coincidan con tu búsqueda.</p>";
 document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>add(Number(b.dataset.add)));
}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;const v=$(`v-${id}`)?.value||"";const found=cart.find(x=>x.id===id&&x.variant===v);if(found)found.qty++;else cart.push({id,name:p.name,variant:v,qty:1});updateCart();}
function updateCart(){$("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);$("cartItems").innerHTML=cart.length?cart.map((x,i)=>`<div class="cartLine"><span><b>${esc(x.name)}</b><br>${esc(x.variant)}</span><input type="number" min="1" max="999" value="${x.qty}" data-qty="${i}"><button data-remove="${i}">×</button></div>`).join(""):"<p>Tu carrito está vacío.</p>";document.querySelectorAll("[data-qty]").forEach(e=>e.onchange=()=>{cart[Number(e.dataset.qty)].qty=Math.max(1,Math.min(999,Number(e.value)||1));updateCart();});document.querySelectorAll("[data-remove]").forEach(e=>e.onclick=()=>{cart.splice(Number(e.dataset.remove),1);updateCart();});}
$("openCart").onclick=()=>{$("cartModal").classList.remove("hidden");updateCart();};
$("closeCart").onclick=()=>$("cartModal").classList.add("hidden");
$("cartModal").onclick=e=>{if(e.target.id==="cartModal")$("cartModal").classList.add("hidden");};
$("search").oninput=render;
$("sendQuote").onclick=()=>{if(!cart.length){alert("Agrega al menos un producto.");return;}const name=$("customerName").value.trim();if(!name){alert("Escribe tu nombre para enviar la cotización.");return;}const lines=cart.map(x=>`• ${x.qty} x ${x.name}${x.variant?" - "+x.variant:""}`).join("\n");const note=$("customerNote").value.trim();const msg=`Hola, soy ${name}. Deseo cotizar estos productos de DYAMEDIX:\n${lines}${note?"\n\nNota: "+note:""}\n\nQuedo atento(a) a su cotización.`;const number=$("whatsappChoice").value;window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`,"_blank");};
load();
