'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,CalendarDays,Check} from 'lucide-react';

type CalendlyWindow=Window & {Calendly?:{initInlineWidget:(options:{url:string;parentElement:HTMLElement;prefill:{name:string;email:string};utm:{utmSource:string;utmMedium:string;utmContent:string}})=>void}};
let widgetPromise:Promise<void>|undefined;
function loadWidget(){
 if((window as CalendlyWindow).Calendly)return Promise.resolve();
 if(!widgetPromise)widgetPromise=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://assets.calendly.com/assets/external/widget.js';script.async=true;
  script.onload=()=>resolve();script.onerror=()=>{script.remove();widgetPromise=undefined;reject(new Error('Calendar unavailable'));};document.head.appendChild(script);
 });
 return widgetPromise;
}
export default function CalendlyBooking({url,requestId,name,email,timezone,onBooked}:{url:string;requestId:string;name:string;email:string;timezone:string;onBooked:()=>void}){
 const container=useRef<HTMLDivElement>(null);const [opened,setOpened]=useState(false);const [loaded,setLoaded]=useState(false);const [failed,setFailed]=useState(false);const [booked,setBooked]=useState(false);const [calendarConsent,setCalendarConsent]=useState(false);
 const bookingUrl=new URL(url);bookingUrl.searchParams.set('utm_source','realecall');bookingUrl.searchParams.set('utm_medium','website');bookingUrl.searchParams.set('utm_content','rc-'+requestId);bookingUrl.searchParams.set('timezone',timezone);
 useEffect(()=>{
  if(!opened)return;let stopped=false;setFailed(false);
  const receive=(event:MessageEvent)=>{
   const frame=container.current?.querySelector('iframe');
   if(event.origin!=='https://calendly.com'||event.source!==frame?.contentWindow||event.data?.event!=='calendly.event_scheduled')return;
   // This changes the on-screen message only. The tracker is updated by an independently verified provider event.
   setBooked(true);onBooked();
  };
  window.addEventListener('message',receive);
  const timeout=window.setTimeout(()=>{if(!stopped)setFailed(true);},20000);
  loadWidget().then(()=>{if(stopped||!container.current)return;const calendly=(window as CalendlyWindow).Calendly;if(!calendly)throw Error('Unavailable');calendly.initInlineWidget({url:bookingUrl.toString(),parentElement:container.current,prefill:{name,email},utm:{utmSource:'realecall',utmMedium:'website',utmContent:'rc-'+requestId}});setLoaded(true);window.clearTimeout(timeout);}).catch(()=>{if(!stopped)setFailed(true);});
  return()=>{stopped=true;window.clearTimeout(timeout);window.removeEventListener('message',receive);container.current?.replaceChildren();};
 // One calendar is mounted for this saved request; its submitted contact details are stable.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[opened]);
 return <section className="booking-panel" aria-label="Book a discovery call">
  <div className="booking-heading"><span>{booked?<Check size={22}/>:<CalendarDays size={22}/>}</span><div><h3>{booked?'Thank you — your discovery call is booked.':'Choose a time. Let’s meet.'}</h3><p>{booked?'Check the email address you used in Calendly for your date, time, time zone, Google Meet details, and links to manage your booking. Check spam or junk if needed.':'Pick an available 30-minute Google Meet slot. Calendly confirms your appointment as soon as you complete the booking.'}</p></div></div>
  {!opened?<><label className="consent"><input type="checkbox" name="calendarConsent" checked={calendarConsent} onChange={e=>setCalendarConsent(e.target.checked)}/><span>I agree to share my name and email with Calendly to arrange my call, and let RealeCall use my booking details for appointment emails. <a href="https://calendly.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer">Calendly privacy notice</a></span></label><button className="button booking-inline-start" disabled={!calendarConsent} onClick={()=>setOpened(true)}>Choose an available slot <ArrowUpRight size={17}/></button></>:<><div aria-live="polite">{!loaded&&!failed&&<p>Loading available times…</p>}{failed&&<p>The calendar is taking longer to load. You can continue using the link below.</p>}</div><div className="calendly-mount" ref={container}/></>}
  {calendarConsent&&!booked&&<><p className="mobile-calendar-note">Prefer a full page? You can also choose your time directly in Calendly.</p><a className="text-link booking-external" href={bookingUrl.toString()} target="_blank" rel="noopener noreferrer">Choose a time in Calendly <ArrowUpRight size={15}/></a></>}
  {!booked&&<p className="form-small">Your inquiry is already saved. A slot is reserved only after Calendly shows the booking confirmation.</p>}
 </section>;
}
