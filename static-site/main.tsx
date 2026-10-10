import {createRoot} from 'react-dom/client';
import Landing from '../app/landing';
import '../app/globals.css';
import '../app/brand-design.css';
import '../app/responsive.css';

declare const __REALECALL_API_ORIGIN__:string;
declare const __REALECALL_BASE_PATH__:string;

window.REALECALL_PUBLIC_SITE={basePath:__REALECALL_BASE_PATH__,apiOrigin:__REALECALL_API_ORIGIN__};
const theme=window.location.pathname.replace(/\/$/,'').endsWith('/soft-ice')?'ice':'royal';
createRoot(document.getElementById('root')!).render(<Landing theme={theme}/>);
