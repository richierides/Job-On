const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const page=await browser.newPage({viewport:{width:393,height:852}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/plans/**',route=>route.fulfill({status:route.request().method()==='GET'?404:200,contentType:'application/json',body:JSON.stringify({revision:'isolated-fixture'})}));
 await page.goto('http://127.0.0.1:8092');await page.getByText('A home,').waitFor();
 const button=n=>page.getByRole('button',{name:n,exact:true});
 const read=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('hometaking-durable',1);r.onsuccess=()=>{const q=r.result.transaction('documents').objectStore('documents').get('project');q.onsuccess=()=>resolve(JSON.parse(q.result));q.onerror=()=>reject(q.error);};}));
 await page.waitForTimeout(500);const before=await read();
 await button('Project settings').click();await page.getByRole('textbox',{name:'Email',exact:true}).waitFor();
 const chooser=page.waitForEvent('filechooser');await button('Import Room Planner rooms and tasks').click();
 const fixture={rooms:[{id:'qa-import',name:'Imported QA',room:{w:333,d:277},items:[{id:'qa-shelf',name:'Shelf',kind:'shelf',w:70,d:20,x:80,y:60,rot:37,owned:false,price:55},{id:'qa-socket',name:'Socket',kind:'socket',w:15,d:3,x:150,y:1.5,rot:0,owned:true}]}],tasks:[{id:'qa-task',body:'Check measurements',comment:'Keep this exact note',done:true,position:0}]};
 await (await chooser).setFiles({name:'room-planner.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByText('Imported QA: new', {exact:false}).waitFor();await button('Add reviewed imports').click();await page.waitForTimeout(700);
 const after=await read();assert.equal(after.rooms.length,before.rooms.length+1);assert.deepEqual(after.rooms[0],before.rooms[0]);assert.equal(after.rooms.at(-1).items[0].rotation,37);assert.equal(after.rooms.at(-1).height,null);assert.equal(after.householdTasks[0].comment,'Keep this exact note');
 await button('Household work and shopping').click();await page.getByText('Check measurements',{exact:false}).waitFor();await button('Close dialog').click();await page.reload();await page.getByText('A home,').waitFor();assert.deepEqual(await read(),after);
 await page.getByRole('button',{name:'Open room: Imported QA',exact:true}).click();await page.getByRole('tab',{name:'Rooms',exact:true}).click();await button('Discuss the layout').click();await page.getByRole('textbox',{name:'Your message',exact:true}).fill('Move the shelf');await button('Ask for a proposal').click();await page.getByText('Sign in through Project settings',{exact:false}).waitFor();
 await page.screenshot({path:'/tmp/hometaking-combined-browser.png'});assert.deepEqual(errors,[]);console.log('PASS: account entry, additive import, unknown heights, shelf/socket preservation, ordered tasks, IndexedDB reload, signed-out conversation guard; no browser exceptions.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
