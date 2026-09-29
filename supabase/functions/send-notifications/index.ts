import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
serve(async req=>{
 try{
  const {phone,message}=await req.json(); const sid=Deno.env.get("TWILIO_ACCOUNT_SID"),token=Deno.env.get("TWILIO_AUTH_TOKEN"),from=Deno.env.get("TWILIO_FROM");
  if(!sid||!token||!from)return new Response(JSON.stringify({configured:false,message:"Configure o provedor de SMS/WhatsApp"}),{headers:{"Content-Type":"application/json"}});
  const body=new URLSearchParams({To:phone,From:from,Body:message});
  const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:"POST",headers:{Authorization:"Basic "+btoa(`${sid}:${token}`),"Content-Type":"application/x-www-form-urlencoded"},body});
  const d=await r.json(); return new Response(JSON.stringify(r.ok?{sent:true,id:d.sid}:{error:d?.message||"Falha"}),{status:r.ok?200:400,headers:{"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e?.message||"Erro"}),{status:500,headers:{"Content-Type":"application/json"}})}
});