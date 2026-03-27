import './tabContent.scss';

import { initializePublishTab } from './publishTab/bootstrap';

declare const APP_VERSION: string;

initializePublishTab(APP_VERSION);
