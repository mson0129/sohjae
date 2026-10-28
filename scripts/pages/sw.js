// Retire the former workspace worker without touching saved user documents.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const prefix='sohjae-offline:'+self.registration.scope+':';
 for(const key of await caches.keys())if(key.startsWith(prefix))await caches.delete(key);
 await self.registration.unregister();
})()));
