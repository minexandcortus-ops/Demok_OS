const https = require('https');
const checkUrl = (url) => {
  https.request(url, { method: 'HEAD' }, (res) => {
    console.log(url, '=>', res.statusCode);
  }).end();
};
checkUrl('https://www.assemblee-nationale.fr/dyn/17/textes/l17b2869_proposition-loi');
checkUrl('https://www.assemblee-nationale.fr/dyn/17/textes/l17b2869_proposition-loi.pdf');
