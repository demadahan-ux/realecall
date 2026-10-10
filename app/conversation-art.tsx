import {ArrowUpRight,Headphones,MessageCircle,Phone} from 'lucide-react';

export default function ConversationArt(){
 return <div className="connection-art" aria-label="Illustration: human support connects your customers and your business">
  <div className="connection-top"><span>THE HUMAN SIDE OF SUPPORT</span><ArrowUpRight size={22}/></div>
  <svg className="connection-ribbon" viewBox="0 0 520 560" fill="none" aria-hidden="true">
   <defs><linearGradient id="ribbon" x1="45" y1="55" x2="450" y2="515" gradientUnits="userSpaceOnUse"><stop stopColor="#91e9ff"/><stop offset=".45" stopColor="#2a83ff"/><stop offset="1" stopColor="#2153f4"/></linearGradient></defs>
   <path d="M-75 177H267C372 177 429 232 429 319C429 402 374 459 289 459H219C135 459 77 400 77 318C77 235 130 177 218 177" stroke="url(#ribbon)" strokeWidth="96"/>
   <path d="M-75 177H267C372 177 429 232 429 319C429 402 374 459 289 459H219C135 459 77 400 77 318C77 235 130 177 218 177" stroke="#a4eaff" strokeOpacity=".35" strokeWidth="1"/>
   <path d="M480 -50V120C480 150 461 172 431 172" stroke="#8bcaf8" strokeOpacity=".35" strokeWidth="1"/>
   <circle cx="431" cy="172" r="5" fill="#a5ebff"/><path d="M12 492H111" stroke="#8bcaf8" strokeOpacity=".35"/><circle cx="111" cy="492" r="4" fill="#a5ebff"/>
  </svg>
  <div className="hello-note"><span className="hello-icon"><MessageCircle size={22}/></span><span>Hello<span className="hello-dot">.</span></span><small>A real connection starts here.</small></div>
  <div className="support-note"><span className="note-avatar"><Headphones size={22}/></span><div><strong>“We’re here to help.”</strong><span>Thoughtful. Professional. Human.</span></div><span className="note-spark">✳</span></div>
  <div className="connection-bottom"><span><Phone size={14}/> YOUR CUSTOMERS</span><span className="connection-rule"/><span>YOUR TEAM <ArrowUpRight size={14}/></span></div>
  <p className="illustration-label">An illustration of the support we believe in</p>
 </div>;
}
