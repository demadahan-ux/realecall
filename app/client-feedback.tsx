'use client';

import {useRef,useState,type KeyboardEvent} from 'react';
import {ArrowLeft,ArrowRight,Clock3,MessageSquareQuote,Star} from 'lucide-react';
import './client-feedback.css';

// Only ratings visible in the supplied Upwork records are shown as stars.
// The One-Click team commendation did not include a numeric rating.
const feedback=[
 {id:'team-commendation',kind:'commendation',title:'You guys are the best!',label:'A note from a client',source:'One-Click Virtual Support',detail:'Client commendation',context:'Shared after the team helped bring a customer support backlog under control.'},
 {id:'product-launch',kind:'rating',title:'Customer Service for New Product Launch',label:'Customer service',source:'Upwork',detail:'Completed contract',rating:5,hours:'5,355',period:'August 2020 – October 2025'},
 {id:'ecommerce-support',kind:'rating',title:'Customer Support Agent for eCommerce company',label:'Ecommerce support',source:'Upwork',detail:'Completed contract',rating:5,hours:'2',period:'August 2026'}
] as const;

function Rating({value}:{value:number}){
 return <div className="feedback-rating" aria-label={`${value} out of 5 stars`}>
  <span className="feedback-stars" aria-hidden="true">{Array.from({length:5},(_,i)=><Star key={i} size={19} fill="currentColor" strokeWidth={0}/>)}</span>
  <strong aria-hidden="true">{value.toFixed(1)}<span> / 5</span></strong>
 </div>;
}

export default function ClientFeedback(){
 const track=useRef<HTMLDivElement>(null);
 const [active,setActive]=useState(0);

 function goTo(index:number){
  const rail=track.current;
  const card=rail?.children[index] as HTMLElement|undefined;
  if(!rail||!card)return;
  const left=rail.scrollLeft+card.getBoundingClientRect().left-rail.getBoundingClientRect().left;
  rail.scrollTo({left,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }

 function syncPosition(){
  const rail=track.current;
  if(!rail)return;
  const left=rail.getBoundingClientRect().left;
  let nearest=0,distance=Infinity;
  Array.from(rail.children).forEach((card,index)=>{
   const current=Math.abs(card.getBoundingClientRect().left-left);
   if(current<distance){nearest=index;distance=current;}
  });
  setActive(nearest);
 }

 function onKeyDown(event:KeyboardEvent<HTMLDivElement>){
  if(event.target!==event.currentTarget)return;
  const next=event.key==='ArrowRight'?Math.min(active+1,feedback.length-1):event.key==='ArrowLeft'?Math.max(active-1,0):event.key==='Home'?0:event.key==='End'?feedback.length-1:null;
  if(next!==null){event.preventDefault();goTo(next);}
 }

 return <section id="client-feedback" className="section feedback-section"><div className="container">
  <div className="section-heading"><div><p className="eyebrow">EXPERIENCE BEHIND THE SERVICE</p><h2>Good support<br/><span>leaves an impression.</span></h2></div><p>Selected client ratings and team commendations, alongside past results from One-Click Virtual Support.</p></div>

  <div className="feedback-carousel" role="region" aria-roledescription="carousel" aria-label="Client feedback">
   <div className="feedback-carousel-top"><p>IN OUR CLIENTS’ WORDS <span>&amp; RATINGS</span></p><span className="feedback-swipe-hint">Swipe to explore <ArrowRight size={14} aria-hidden="true"/></span></div>
   <div id="feedback-slides" className="feedback-track" ref={track} onScroll={syncPosition} onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label="Feedback cards. Use the left and right arrow keys to browse.">
    {feedback.map((item,index)=><article key={item.id} className={`feedback-card feedback-card-${item.kind}`} role="group" aria-roledescription="slide" aria-label={`${index+1} of ${feedback.length}: ${item.label}`} aria-hidden={active!==index}>
     <div className="feedback-card-main">
      <div className="feedback-card-meta"><span>{item.label}</span>{item.kind==='rating'?<Rating value={item.rating}/>:<MessageSquareQuote size={25} aria-hidden="true"/>}</div>
      {item.kind==='commendation'?<><blockquote>“You guys are<br/><mark>the best!</mark>”</blockquote><p className="feedback-card-description">{item.context}</p></>:<><h3>{item.title}</h3><p className="feedback-card-description">A <strong>5-star client rating</strong> for a completed customer support engagement.</p></>}
     </div>
     <div className="feedback-card-details">
      <div className="feedback-source"><span className={item.source==='Upwork'?'feedback-upwork':'feedback-team-source'}>{item.source}</span><span>{item.detail}</span></div>
      {item.kind==='rating'?<><div className="feedback-hours"><Clock3 size={17} aria-hidden="true"/><span><strong>{item.hours}</strong> hours worked</span></div><p className="feedback-period">{item.period}</p></>:<div className="feedback-team-note"><span className="feedback-mini-rule"/><p>Less backlog.<br/> More peace of mind.</p><span>Customer support &amp; ticket management</span></div>}
     </div>
    </article>)}
   </div>
   <div className="feedback-navigation">
    <div className="feedback-dots" role="group" aria-label="Choose a feedback slide">{feedback.map((item,index)=><button type="button" key={item.id} onClick={()=>goTo(index)} aria-label={`Show feedback ${index+1}: ${item.label}`} aria-current={active===index?'true':undefined} aria-controls="feedback-slides"><span/></button>)}</div>
    <div className="feedback-page-controls"><span className="feedback-page-count" aria-live="polite" aria-atomic="true"><span className="feedback-sr-only">Feedback </span>{String(active+1).padStart(2,'0')}<span> / {String(feedback.length).padStart(2,'0')}</span></span><button type="button" onClick={()=>goTo(active-1)} disabled={active===0} aria-label="Previous feedback" aria-controls="feedback-slides"><ArrowLeft size={20}/></button><button type="button" onClick={()=>goTo(active+1)} disabled={active===feedback.length-1} aria-label="Next feedback" aria-controls="feedback-slides"><ArrowRight size={20}/></button></div>
   </div>
  </div>

  <div className="feedback-results-heading"><p className="eyebrow">PAST TEAM RESULTS</p><span>One-Click Virtual Support</span></div>
  <div className="feedback-results">
   <article><div className="feedback-result-number"><strong>~1,900</strong><ArrowRight size={25} aria-hidden="true"/><strong>25</strong></div><h3>Unsolved tickets reduced</h3><p>A customer support backlog brought down to a much more manageable queue.</p></article>
   <article><div className="feedback-result-number"><strong>85%</strong><ArrowRight size={25} aria-hidden="true"/><strong>91%</strong></div><h3>More calls answered</h3><p>A 6 percentage point increase in call answer rate, from January to May 2024.</p></article>
  </div>
  <p className="feedback-context">Client ratings are from shared Upwork work history. Team commendations and operational results reflect past One-Click Virtual Support engagements.</p>
 </div></section>;
}
