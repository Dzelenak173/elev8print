export const TERMS_VERSION='Draft 2026-10-20.1';
export const TERMS=[
['Check your proof','Please check spelling, numbers, artwork, placement, orientation, dimensions, and cut lines. If your design includes a QR code or barcode, check its content and intended destination.'],
['Color and special finishes','Screens may display colors differently from printed materials. Holographic effects, white ink, and spot UV may not be fully represented in a digital proof. If you need a specific color match or physical sample, request it before approving.'],
['Artwork rights and permission','You confirm that you own the submitted artwork or have the permissions or other legal rights necessary for Elev8 Print to reproduce it for this order. This includes any images, logos, fonts, trademarks, and other supplied content.\n\nYou authorize Elev8 Print and any production providers involved in fulfilling this order to reproduce the artwork and make necessary technical preparations consistent with your approved proof. This permission does not authorize promotional use of your artwork unless you separately opt in below.\n\nElev8 Print may request evidence of permission and may pause or decline an order if rights are unclear.'],
['Approval and changes','Your approval applies to the proof version and specifications shown above.\n\nYou accept responsibility for content errors visible in the proof that you approve, such as incorrect spelling or numbers. If we print according to that approved proof and specifications, corrections to those approved errors may require a paid reprint.\n\nThis approval does not excuse production defects or printing that differs from the approved proof and specifications.\n\nIf you need changes, select Request Changes. Any revised artwork or specifications must be approved again before printing. Changes requested after approval may affect price and timing; changes may no longer be possible once production begins.']
];
export const CONSENTS=[
'I have reviewed and approve this proof and the order specifications shown above.',
'I confirm that I have the legal rights necessary to authorize printing of the submitted artwork.',
'I agree to the approval terms above and authorize Elev8 Print to print this version. I am authorized to approve this order for myself or the business named below.'
];
export const PROMO='I authorize Elev8 Print to photograph and display my completed printed products on its website, social media, and promotional materials. I confirm I have authority to grant this permission.';
export const SIGNATURE='By typing my name and selecting Approve for Printing, I intend to sign this approval electronically.';
export const PROMO_NOTE='This is optional and does not affect your order or artwork approval. Customer contact information and order details will not be shared.';
export const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export function sample(){return {id:newId(),designId:newId(),orderId:newId(),designName:'Make Good Things',order:'E8-DEMO-001',version:1,customer:'Sample customer',email:'customer@example.com',product:'Die-cut stickers',quantity:250,width:3,height:3,units:'in',material:'Holographic vinyl',finish:'Gloss laminate',special:'White ink behind lettering and dark background. Holographic border remains visible. No spot UV.',notes:'Sample artwork for testing the approval process.',proof:'sample-proof.svg',filename:'make-good-things-proof.svg',type:'image/svg+xml',status:'pending',created:new Date().toISOString(),termsVersion:TERMS_VERSION,terms:structuredClone(TERMS),consents:[...CONSENTS],promoText:PROMO,promoNote:PROMO_NOTE,signatureText:SIGNATURE};}
export function sampleOrder(){
 const a=sample();
 const b={...sample(),orderId:a.orderId,designName:'Stay Curious',proof:'sample-curious.svg',filename:'stay-curious-proof.svg',quantity:150,width:2.5,height:2.5,material:'White vinyl',finish:'Matte laminate',special:'Full-color print. No spot UV.'};
 const c={...sample(),orderId:a.orderId,designName:'Elev8 Shipping Seal',proof:'sample-seal.svg',filename:'shipping-seal-proof.svg',quantity:500,width:4,height:1.5,material:'White vinyl',finish:'Gloss laminate',special:'Rounded rectangle cut. No white ink or spot UV.'};
 return [a,b,c];
}
// Preserve old single-design orders and historical responses without altering accepted terms.
export function migrate(records){
 const orderIds=new Map(),designIds=new Map();
 for(const x of records){if(x.orderId)orderIds.set(x.order,x.orderId);if(!x.designId&&!designIds.has(x.order))designIds.set(x.order,newId());}
 return records.map(x=>{if(!orderIds.has(x.order))orderIds.set(x.order,newId());return {...x,orderId:x.orderId||orderIds.get(x.order),designId:x.designId||designIds.get(x.order),designName:x.designName||x.product||'Artwork'};});
}
export function currentDesigns(records,orderId){
 const result=new Map();
 for(const x of records.filter(x=>x.orderId===orderId)){const old=result.get(x.designId);if(!old||x.version>old.version)result.set(x.designId,x);}
 return [...result.values()].sort((a,b)=>a.designName.localeCompare(b.designName));
}
export function respond(records,id,action,input){
 const p=records.find(x=>x.id===id);if(!p)throw Error('Proof not found.');
 if(p.status!=='pending')throw Error('This proof is no longer awaiting a response.');
 if(records.some(x=>x.designId===p.designId&&x.version>p.version))throw Error('A newer proof exists for this design. Please review the latest version.');
 if(!input.name?.trim()||!/^\S+@\S+\.\S+$/.test(input.email?.trim()||''))throw Error('Enter your full name and a valid email address.');
 if(action==='approve'&&(!input.consents||input.consents.length!==3||!input.consents.every(Boolean)))throw Error('Confirm all three approval statements. Promotional permission is optional.');
 if(action==='changes'&&!input.comments?.trim())throw Error('Describe the changes you need.');
 if(!['approve','changes'].includes(action))throw Error('Unknown response.');
 const next=structuredClone(records),target=next.find(x=>x.id===id);
 target.status=action==='approve'?'approved':'changes';
 target.response={name:input.name.trim(),email:input.email.trim(),business:input.business?.trim()||'',at:new Date().toISOString(),consents:action==='approve'?[...input.consents]:[],promotional:action==='approve'&&!!input.promotional,restrictions:action==='approve'&&input.promotional?input.restrictions?.trim()||'':'',comments:action==='changes'?input.comments.trim():'',termsVersion:p.termsVersion};
 return next;
}
export const BATCH_CONSENTS=[
'I have reviewed and approve the artwork, proof versions, and print specifications for the designs marked Approve in this submission.',
'I confirm that I have the legal rights necessary to authorize printing of the designs marked Approve in this submission.',
'I agree to the approval terms and authorize Elev8 Print to print the designs marked Approve. I am authorized to approve this order for myself or the business named below.'
];
export const BATCH_PROMO='I authorize Elev8 Print to photograph and display the completed printed products for the designs I approve in this submission on its website, social media, and promotional materials. I confirm I have authority to grant this permission.';
export const BATCH_SIGNATURE='By typing my name and selecting Submit Responses, I intend to sign the approvals selected in this submission electronically. Designs marked Request Changes or Decide Later are not approved.';
export function respondBatch(records,orderId,decisions,input){
 const chosen=Object.entries(decisions).filter(([,d])=>d.action==='approve'||d.action==='changes');
 if(!chosen.length)throw Error('Choose Approve or Request Changes for at least one design.');
 const approvedIds=chosen.filter(([,d])=>d.action==='approve').map(([id])=>id);
 const batchId=newId(),at=new Date().toISOString();
 let next=structuredClone(records);
 // Build all responses on a copy; a failed design leaves the original order untouched.
 for(const [id,decision] of chosen){
  const original=records.find(x=>x.id===id);
  if(!original||original.orderId!==orderId)throw Error('The selected design does not belong to this order.');
  next=respond(next,id,decision.action,{...input,comments:decision.comments||''});
  const target=next.find(x=>x.id===id);
  if(decision.action==='approve'){
   target.consents=[...BATCH_CONSENTS];target.promoText=BATCH_PROMO;target.signatureText=BATCH_SIGNATURE;
  }
  target.response={...target.response,batchId,at,approvedProofIds:[...approvedIds]};
 }
 return next;
}
export function addProof(records,details,baseId=null,existingOrderId=null){
 const next=structuredClone(records),base=baseId?next.find(x=>x.id===baseId):null;
 if(baseId&&!base)throw Error('Original proof not found.');
 const order=base||(existingOrderId?next.find(x=>x.orderId===existingOrderId):null);
 if(existingOrderId&&!order)throw Error('Order not found.');
 if(!order&&next.some(x=>x.order.toLowerCase()===String(details.order).toLowerCase()))throw Error('That order already exists. Use Add design to add artwork to it.');
 const version=base?Math.max(...next.filter(x=>x.designId===base.designId).map(x=>x.version))+1:1;
 if(base)next.filter(x=>x.designId===base.designId&&x.status==='pending').forEach(x=>x.status='superseded');
 const proof={...sample(),...(base||{}),...details,id:newId(),orderId:order?order.orderId:newId(),designId:base?base.designId:newId(),order:order?order.order:details.order,customer:order?order.customer:details.customer,email:order?order.email:details.email,version,status:'pending',created:new Date().toISOString(),termsVersion:TERMS_VERSION,terms:structuredClone(TERMS),consents:[...CONSENTS],promoText:PROMO,promoNote:PROMO_NOTE,signatureText:SIGNATURE};delete proof.response;
 next.unshift(proof);return {records:next,proof};
}
