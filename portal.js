
      AFRAME.registerComponent('player-portal-camera-rig', {
        schema: {
          destinationOrientation: {type: 'vec3', default: {x: 0, y: 0, z: 1}},
          playerId: {type: 'string', default: 'player'},
          destinationPortalId: {type: 'string'},
          sourcePortalId: {type: 'string'},
          aspectRatio: {type:'number', default: 1},
          fov: {type:'number', default: 120},
          resolution: {type:'number', default: 1024},
        },
        tick:function(){
          var playerPosition = document.getElementById(this.data.playerId).object3D.position.clone();
          var playerRotation = document.getElementById(this.data.playerId).object3D.rotation.clone();
          var destinationOrientation = document.getElementById(this.data.destinationPortalId).object3D.rotation.clone();
          var sourceOrientation = document.getElementById(this.data.sourcePortalId).object3D.rotation.clone();
          
          // The view on the source portal should look as though you are on the other side of the destination portal. 
          // So if you are (x,y,z) position with respect to the source portal, you'll be (-x, y, -z) with respect to the destination portal
          var sourceRelativeLocation = document.getElementById(this.data.sourcePortalId+"-"+"frame").object3D.worldToLocal(playerPosition);
          var sourceMirroredLocation = new THREE.Vector3(-sourceRelativeLocation.x, sourceRelativeLocation.y, -sourceRelativeLocation.z);
          var destinationWorldLocation = document.getElementById(this.data.destinationPortalId+"-"+"frame").object3D.localToWorld(sourceMirroredLocation);
          var destinationLocalLocation = document.getElementById(this.data.sourcePortalId+"-"+"frame").object3D.worldToLocal(destinationWorldLocation);
          this.el.object3D.position.copy(destinationLocalLocation);
          this.el.object3D.rotation.copy(playerRotation);
          //The formula for rotation required some derivation using some vector diagrams. The x and y rotations need to be the same as the players original rotation values. We just need to change the y orientation.
          // So final y orientation should make sure we account for the relative rotation between source and destination portals and the orientation of the player with respect to the normal of the source portal.
          // The basic units of this calculation have been separated in the brackets. Final orientation is (this.el.object3D.rotation.y-sourceOrientation.y)+(0.5*Math.PI - sourceOrientation.y)+(0.5*Math.PI + destinationOrientation.y);
          this.el.object3D.rotation.y = this.el.object3D.rotation.y-2*sourceOrientation.y+Math.PI+ destinationOrientation.y;
          
          //Update Portal View
          const renderer = this.el.sceneEl.renderer;
          const currentRenderTarget = renderer.getRenderTarget();
          const currentXrEnabled = renderer.xr.enabled;
          const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

          renderer.xr.enabled = false;
          renderer.shadowMap.autoUpdate = false;
          
          renderer.setRenderTarget(this.renderTarget);
          renderer.render(this.el.sceneEl.object3D, this.myCamera);
          this.targetPlane.material = new THREE.MeshBasicMaterial({
    	      map: this.renderTarget.texture});

          renderer.xr.enabled = currentXrEnabled;
          renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
          renderer.setRenderTarget(currentRenderTarget);
          
        },
        init:function(){
          this.targetPlane =  this.el.sceneEl.object3D.getObjectByName( this.data.sourcePortalId+"-"+"face" );
          this.myCamera = new THREE.PerspectiveCamera(this.data.fov, this.data.aspectRatio, 0.01, 2000);
          this.el.object3D.add(this.myCamera);
          this.renderTarget = new THREE.WebGLRenderTarget(
            this.data.resolution, this.data.resolution, {minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter});
          
        }
          
        
        
      });
      
      AFRAME.registerComponent('portal', {
        schema: {
          height: {type: 'number', default: 3.2},
          depth: {type: 'number', default: 0.1},
          width: {type: 'number', default:2.0},
          cameraColor: {default: "#9CE3F9"},
          portalFaceColor: {default: "blue"},
          portalFrameColor: {default: "blue"},
          destinationPortalId: {type: 'string'}
        },
        createPortalElements:  function(){
          //This function creates a frame for the portal (sort of like a door frame). 
          // The actual portal is a plane mesh which acts as a render target for a portalPlayerCamera assigned to each portal. 
          // The portal face is used to set a location relative to the portal where a user should teleport. 
          // If we just teleport to the location of the portal we'll be stuck in an infinite loop of teleportations due to the way that the colliders for the portal and player are set up.
          // Sadly, that would have been the ideal way of setting up the portal. It would have given me the feeling of actually having a non-euclidean space.
          // In hindsight I should have only enabled teleportation if the player is looking at the portal or approaching it from the front. 
          
          var portalFrame = document.createElement("a-box");
          portalFrame.object3D.position.copy(new THREE.Vector3(0,0,-this.data.depth));
          portalFrame.setAttribute("height", this.data.height);
          portalFrame.setAttribute("width", this.data.width);
          portalFrame.setAttribute("depth", this.data.depth);
          portalFrame.setAttribute("color", this.data.portalFrameColor);
          portalFrame.setAttribute("id", this.el.id+"-"+"frame");
          portalFrame.setAttribute("class", "portal-frame");
          portalFrame.setAttribute("aabb-collider",{objects: "#player-body"});
          this.el.appendChild(portalFrame);
          
          var portalFace = document.createElement("a-plane");
          portalFace.object3D.position.add(new THREE.Vector3(0,0,0.6));
          portalFace.setAttribute("height", this.data.height-0.01);
          portalFace.setAttribute("width", this.data.width-0.01);
          portalFace.setAttribute("visible", false);
          portalFace.setAttribute("id", this.el.id+"-"+"face");
          this.el.appendChild(portalFace);
          
          var targetPlane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(this.data.width-0.1, this.data.height-0.1),
            new THREE.MeshBasicMaterial({color: this.data.portalFaceColor})
          );
          targetPlane.position.set(0,0,0);
          targetPlane.name= this.el.id+"-"+"face";
          this.el.object3D.add(targetPlane);
          
          var portalPlayerCamera = document.createElement("a-box");
          portalPlayerCamera.setAttribute("height", "0.1");
          portalPlayerCamera.setAttribute("width", "0.1");
          portalPlayerCamera.setAttribute("depth", "0.2");
          portalPlayerCamera.setAttribute("color", this.data.cameraColor);
          portalPlayerCamera.setAttribute("player-portal-camera-rig",{
            destinationPortalId: this.data.destinationPortalId, 
            sourcePortalId: this.el.id,
            aspectRatio:this.data.width/this.data.height
          });
          portalPlayerCamera.setAttribute("id", this.el.id+"-"+"player-camera");

          this.el.appendChild(portalPlayerCamera);
          
        },
        init:function(){
          this.createPortalElements();
        },
        tick: function(){
          
        }
      });


     function setLayers(){
      var layer = 3; //This could be any integer between 2 and 31. Anything that wont mess with the left eye, right eye layer settings for a VR camera.
      // Make the objects in layer visible to the player's camera
      $("#player")[0].object3D.traverse(function(obj){if(obj.type=="PerspectiveCamera"){obj.layers.enable(layer)}});
      // Make the portal invisible to the portal's rendering cameras by placing them in layer 3. The rendering cameras with id (portal#-player-camera) can't see objects in layer 3, only the player camera can.
      // By doing this we can avoid having to see the back of the destination portal in the source portal view. But we wont be able to see trippy visuals like infinite mirror reflections.
      $("[portal]").toArray().forEach(portalFrame => portalFrame.object3D.traverse(function(obj){if(obj.type=="Mesh"){obj.layers.set(layer)}}));
      // Enable all layers for the lighting so that they also affect the portal elements in layer 3. This makes the portals lit up in whatever layer the player camera is in.
      document.getElementById("home").querySelectorAll("a-entity[light]").forEach(light => light.object3D.children[0].layers.enableAll());
    }

    function setCollisionEvents(){
      //Function to "teleport the user to the destination portal while orienting the user to whatever view they had on the source portal. 
      //If you were looking at an object on the soucre portal, you should be looking at the object when you pass through the portal (or atleast the same direction)"
      var playerEl = document.getElementById('player-body');
      
      //Add a collider to portal frames. aabb-collider allows you to check the src and target of the collision. 
      //donmccurdy's physics-collider does provide a collision type event but both source and target of the collision are reported to be the same for some wierd reason.
       playerEl.setAttribute("aabb-collider",{objects: ".portal-frame"});
       document.querySelectorAll("[aabb-collider]").forEach(function(entity) {
          entity.addEventListener("hitstart", function(event) {
              var sourceId = event.target.id;
              var targetIds = event.target.components["aabb-collider"]["intersectedEls"].map(x => x.id);
              console.log(sourceId,targetIds);
              var playerEl = document.getElementById('player');
              if(sourceId.localeCompare("player-body")==0 && targetIds.length ==1){
                var portalId = targetIds[0].split("-")[0];
                var portalProxy = document.getElementById(portalId+"-"+"player-camera");
                var portalProxyOrientation = portalProxy.object3D.rotation.clone();
                console.log("Before rotation",playerEl.object3D.rotation,portalProxyOrientation)
                
                var destinationPortalId = document.getElementById(portalId).components["portal"].data.destinationPortalId;
                var portalLocation = document.getElementById(destinationPortalId+"-"+"face").object3D.getWorldPosition();
                
                //Update camera rotation and position to "teleport" to the localtion of the destination portal face
                //You can set camera position by using its object3D. But setting orientation requires that you access the look-controls component. 
                //Just editing the rotation variable of the camera's object3D doesn't affect your view orientation on passing the portal due to the look-control component. 
                playerEl.components['look-controls'].yawObject.rotation.y = portalProxyOrientation.y + playerEl.object3D.rotation.y;
                console.log("After rotation",playerEl.object3D.rotation,portalProxyOrientation)
                playerEl.object3D.position.copy(portalLocation);
              }
          });
        });
    }
    window.onload = function(){
      setLayers();
      setCollisionEvents();
    }



