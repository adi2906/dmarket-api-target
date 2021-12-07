import nacl from "tweetnacl";
import * as https from 'https';

export function byteToHexString(uint8arr) {
    if (!uint8arr) {
        return '';
    }
    let hexStr = '';
    const radix = 16;
    const magicNumber = 0xff;
    for (let i = 0; i < uint8arr.length; i++) {
        let hex = (uint8arr[i] & magicNumber).toString(radix);
        hex = (hex.length === 1) ? '0' + hex : hex;
        hexStr += hex;
    }
    return hexStr;
}

function hexStringToByte(str) {
    if (typeof str !== 'string') {
        throw new TypeError('Wrong data type');
    }
    const twoNum = 2;
    const radix = 16;
    const uInt8arr = new Uint8Array(str.length / twoNum);
    for (let i = 0, j = 0; i < str.length; i += twoNum, j++) {
        uInt8arr[j] = parseInt(str.substr(i, twoNum), radix);
    }
    return uInt8arr;
}

function hex2ascii(hexx) {
    const hex = hexx.toString();
    let str = '';
    for (let i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

// api
const publicKey = "";
const secretKey = "";
const host = 'api.dmarket.com';

function getFirstOfferFromMarket() {
    const requestOptions = {
        host: host,
        path: '/exchange/v1/market/items?gameId=a8db&limit=1&currency=USD',
        method: 'GET',
    };
    return new Promise(function(resolve, reject) {
        const request = https.request(requestOptions, (response) => {
            let body = [];
            response.on('data', function(chunk) {
                body.push(chunk);
            });
            response.on('end', function() {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch(e) {
                    reject(e);
                }
                resolve(body['objects'][0]);
            });
        });
        request.end();
    });
}

function buildTargetBodyFromOffer(offer) {
    return {
        "targets": [
            {
                "amount": 1, "gameId": offer.gameId, "price": {"amount": "2", "currency": "USD"},
                "attributes": {
                    "gameId": offer.gameId, "categoryPath": offer.extra.categoryPath, "title": offer.title,
                    "name": offer.title,
                    "image": offer.image,
                    "ownerGets": {"amount": "1", "currency": "USD"}
                }
            }]
    }
}

function sign(string) {
    const signatureBytes = nacl.sign(new TextEncoder('utf-8').encode(string), hexStringToByte(secretKey));
    return byteToHexString(signatureBytes).substr(0,128);
}

function sendNewTargetRequest(requestOptions, targetRequestBody) {
    const req = https.request(requestOptions, (response) => {
        console.log('statusCode:', response.statusCode);
        response.on('data', (responseBodyBytes) => {
            console.log(hex2ascii(byteToHexString(responseBodyBytes)));
        });
    });

    req.on('error', (e) => {
        console.error(e);
    });

    req.write(targetRequestBody);
    req.end();
}

async function createTarget() {
    const firstOffer = await getFirstOfferFromMarket();
    console.log('Offer found: ' + firstOffer.title);

    const method = "POST";
    const apiUrlPath = "/exchange/v1/target/create";
    const targetRequestBody = JSON.stringify(buildTargetBodyFromOffer(firstOffer));
    console.log(targetRequestBody);
    const timestamp = Math.floor(new Date().getTime() / 1000);
     const stringToSign = method + apiUrlPath + targetRequestBody + timestamp;
    const signature = sign(stringToSign);
    const requestOptions = {
        host: host,
        path: apiUrlPath,
        method: method,
        headers: {
            "X-Api-Key": publicKey,
            "X-Request-Sign": "dmar ed25519 " + signature,
            "X-Sign-Date": timestamp,
            'Content-Type': 'application/json',
        }
    };
    sendNewTargetRequest(requestOptions, targetRequestBody);
}


createTarget();