import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const s=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt=(req.headers.get("Authorization")||"").replace("Bearer ",""); const {data:{user}}=await s.auth.getUser(jwt);
  if(!user)throw new Error("Não autenticado");
  const {moodle_url,moodle_token}=await req.json(); if(!moodle_url||!moodle_token)throw new Error("URL e token obrigatórios");
  const base=moodle_url.replace(/\/$/,"")+"/webservice/rest/server.php";
  const q=new URLSearchParams({wstoken:moodle_token,wsfunction:"core_calendar_get_action_events_by_timesort",moodlewsrestformat:"json",limitnum:"100"});
  const r=await fetch(base+"?"+q); const d=await r.json(); if(!r.ok||d?.exception)throw new Error(d?.message||"Moodle recusou a conexão");
  let imported=0; for(const ev of d?.events||[]){const due=new Date(Number(ev.timesort||ev.timestart)*1000).toISOString().slice(0,10);
   const {error}=await s.from("activities").upsert({user_id:user.id,title:ev.name||"Atividade Moodle",description:ev.description||"",due_date:due,source:"moodle",external_id:String(ev.id)},{onConflict:"user_id,source,external_id"}); if(!error)imported++}
  return new Response(JSON.stringify({imported,total:(d?.events||[]).length}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e?.message||"Erro"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});