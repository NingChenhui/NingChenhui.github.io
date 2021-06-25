<link rel="stylesheet" class="aplayer-secondary-style-marker" href="\assets\css\APlayer.min.css"><script src="\assets\js\APlayer.min.js" class="aplayer-secondary-script-marker"></script><script class="meting-secondary-script-marker" src="\assets\js\Meting.min.js"></script>var gl;
var canvas;
var program;
var vPosition;
var vNormal;
var models = {};
var selectedModel;
var keymap={13:'Enter',16:'Shift',27:'Esc',32:'Space',37:'Left',38:'Up',39:'Right',40:'Down',46:'Delete',
65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z'};

var world = {
	scene: 'day',
	time: Date.now(),
	R: 0.001,
	theta: Math.PI / 2,
	autoRotate: false,
	eye: vec3(0.0, 1, 0.001),
	at: vec3(0.0, 0.0, 5),
	up: vec3(0.0, 1.0, 0.0),
	ProjectionType: 'ortho',
	ShadowType: 'line',
	horizon: -0.5,
	lightPosition: vec4(-1.0, 1.0, 1.0, 0.0 ),
	lightAmbient: vec4(1.0, 1.0, 1.0, 1.0 ),
    lightDiffuse: vec4( 1.0, 1.0, 1.0, 1.0 ),
	lightSpecular: vec4( 1.0, 1.0, 1.0, 1.0 ),
	isRunning: false,
	startTime: 0,
	pauseTime: 0,
	speed:3
};
world.update = function() {
	switch(keymap[document.keyCode]){
		case 'I':world.at[2]-=1.5;break;
		case 'J':world.at[0]-=0.1;break;
		case 'K':world.at[2]+=1.5;break;
		case 'L':world.at[0]+=0.1;break;
		case 'P':
			world.ProjectionType=world.ProjectionType=='perspective'?'ortho':'perspective';
			document.keyCode=undefined;break;
		case 'B':
			if(world.isRunning)models.cube.KeyFrames.push((Date.now()-world.startTime)/1000);
			document.keyCode=undefined;break;
		case 'A':
			models['auto_cube'].Printable=true;
			delete models['cube'];
			break;
		case 'Z':
			models['cube1'].Position[0]+=0.1;models['cube2'].Position[0]-=0.1;
			models['cube1'].lastX+=0.1;models['cube2'].lastX-=0.1;
			break;
		case 'X':
			models['cube1'].Position[0]-=0.1;models['cube2'].Position[0]+=0.1;
			models['cube1'].lastX-=0.1;models['cube2'].lastX+=0.1;
			break;
		case 'Delete':
			for(modelname in models)if(models[modelname].Id==selectedModel.Id){
				delete models[modelname];
				selectedModel=undefined;
				models['beacon'].Printable=false;
				document.keyCode=undefined;
				break;
			}
			break;
//三维移动
// T   Y
//  \ /
//F--G--H
//  / \
// V   B
		case 'V':if(selectedModel)selectedModel.Position=add(selectedModel.Position,matmul(selectedModel.getModelStateMatrix(),scale(k,selectedModel.Direction)));break;
		case 'Y':if(selectedModel)selectedModel.Position=subtract(selectedModel.Position,matmul(selectedModel.getModelStateMatrix(),scale(k,selectedModel.Direction)));break;
		case 'T':if(selectedModel)selectedModel.Position=add(selectedModel.Position,matmul(selectedModel.getModelStateMatrix(),scale(k,selectedModel.Up)));break;
		case 'B':if(selectedModel)selectedModel.Position=subtract(selectedModel.Position,matmul(selectedModel.getModelStateMatrix(),scale(k,selectedModel.Up)));break;
		case 'H':if(selectedModel)selectedModel.Position=add(selectedModel.Position,matmul(selectedModel.getModelStateMatrix(),scale(k,selectedModel.Left)));break;
		case 'F':if(selectedModel)selectedModel.Position=subtract(selectedModel.Position,matmul(selectedModel.getModelStateMatrix(),scale(k,selectedModel.Left)));break;
	}
	var nowTime=(Date.now()-world.startTime)/1000;
	if(world.isRunning&&world.Key[world.keyPos]&&nowTime>world.Key[world.keyPos][0]){//add 世界状态
		world.Key[world.keyPos][1]();
		world.keyPos++;
	}
	//if(Math.abs(world.R)<1e-2){console.log(world);inform('world','r过小');world.R+=Math.random()/100-0.005;}
	//if (world.autoRotate) world.theta += Math.PI / 160;
	if (world.autoRotate) {//add 旋转改变
		world.theta = world.thetaS+world.thetaV*((Date.now()-world.startTime)/1000-world.Key[world.keyPos-1][0]);
	}
	if(models.auto_cube)world.at=models.auto_cube.Position;
	if(models.cube)world.at=models.cube.Position;
	world.eye[0] = world.at[0] + world.R * Math.cos(world.theta);
	world.eye[2] = world.at[2] + world.R * Math.sin(world.theta);
	world.time=Date.now();
}
world.getModelViewMatrix = function() {
	return lookAt(this.eye, this.at, this.up);
}
world.getProjectionMatrix = function() {
	minSize = Math.min(canvas.width, canvas.height)/2;
	if (world.ProjectionType == 'ortho') return ortho(-canvas.width / minSize, canvas.width / minSize, -canvas.height / minSize, canvas.height / minSize, -100, 100); //return ortho(left,right,bottom,top,near,far);
	if (world.ProjectionType == 'perspective')return perspective(45,canvas.width/canvas.height,0.001,500);//return perspective(fovy, aspect, near, far);
}
world.getShadowMatrix = function(){
	var h=world.horizon+0.01;
	if(world.ShadowType=='line'){
		var d=subtract(world.lightPosition.slice(0,3),world.at);
		var m=mat4(d[1]);
		for(var i=0;i<3;i++){m[i][1]-=d[i];m[i][3]+=d[i]*h;}
		return m;
	}
	if(world.ShadowType=='point'){
		var m=mat4(world.lightPosition[1]-h);
		for(var i=0;i<3;i++){m[i][1]-=world.lightPosition[i];m[i][3]+=world.lightPosition[i]*h;}
		m[3][1]=-1;
		m[3][3]+=h;
		return m;
	}
}

function inform(title,message,url) {
	if (Notification.permission=="granted") new Notification(title,{body:message,icon:url});
	else if (Notification.permission=="default" && location.href.startsWith("http")) {
		Notification.requestPermission(function (permission) {
			inform(title,message,url);
		});
	}
	else console.log(title+':'+message);
}

function matmul(A, x) {
	B = mat4(vec4(x, 0, 0));
	B = mult(A, transpose(B));
	return transpose(B)[0].slice(0, x.length);
}

window.onload = function init() {
	canvas = document.getElementById("gl-canvas");
	gl = WebGLUtils.setupWebGL(canvas);
	if (!gl) {
		alert("WebGL isn't available");
	}

	program = initShaders(gl, "vertex-shader", "fragment-shader");
	gl.useProgram(program);
	gl.enable(gl.DEPTH_TEST);

	vPosition = gl.getAttribLocation(program, "vPosition");
	gl.enableVertexAttribArray(vPosition);
	vNormal = gl.getAttribLocation(program, "vNormal");
	vTexCoord = gl.getAttribLocation(program, "vTexCoord");
	ModelStateMatrix = gl.getUniformLocation(program, "ModelStateMatrix");
	ModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
	ProjectionMatrix = gl.getUniformLocation(program, "ProjectionMatrix");

	gl.activeTexture(gl.TEXTURE0);
	gl.uniform1i(gl.getUniformLocation(program, "textureId"), 0);

	models['ground'] = initGround();
	models['sky'] = initSky();
	models['beacon']=initTetrahedron();
	models['sun'] = initSun();

	var hit_time=[0].concat(parseMap(omr_normal_map));
	models['auto_cube']=initCube(0xffffff,0);
	models['auto_cube'].KeyFrames=hit_time;
	models['auto_cube'].Printable=false;
	models['cube']=initCube(0x00ff00,0);
	models['cube1']=initCube(0xff0000,-2);
	models['cube1'].KeyFrames=hit_time;
	models['cube2']=initCube(0x0000ff,2);
	models['cube2'].KeyFrames=hit_time;

	world.lineNum=prepareLine();//add 
	world.Key=worldKey;
	world.keyPos=0;

	models['porsche']=new Model({
		Size:0.5,
		Position: [-1, 0, 0],
		Rotation: [0,0,0],
		Up: [0,0,1],
		Direction: [0,1,0],
		dirname: './car/',
		needLoaded: ['porsche.obj','porsche.mtl'],
		onGround: true,
		hasTexture: false,
		Printable: false,
		KeyFrames:[17,25,34,68,75,80],
		KeyPos:0,
	});
	models['porsche'].update=function(){
		var nowTime=(Date.now()-world.startTime)/1000;
			if (nowTime>model.KeyFrames[model.KeyPos]){
				model.Printable=true;
				model.V=14;
				model.KeyPos=model.KeyPos+1;
				model.Position[0]=models['auto_cube'].Position[0];
				model.Position[1]=0;
				model.Position[2]=models['auto_cube'].Position[2]-10;
				//console.log('时间：'+world.gameTime+'线'+' 位置'+model.Position)
			}
		if (this.onGround) this.Position[1] = Math.abs(matmul(this.getRotateMatrix(),this.Bound)[1]) * this.Size + world.horizon;
	}


	models['tiger']=new Model({
		Size:0.7,
		Position: [-1, 0, 0],
		dirname: './animal/',
		needLoaded: ['tigre_sumatra_sketchfab.obj', 'tigre_sumatra_sketchfab.mtl'],
		onGround: true,
		hasMaterial: true,
		Printable: false,
		KeyFrames:[20,30,40,50,60,70,90,100,110],
		KeyPos:0,
	});
	models['tiger'].update=function(){
		var nowTime=(Date.now()-world.startTime)/1000;
			if (nowTime>model.KeyFrames[model.KeyPos]){
				model.Printable=true;
				model.V=14;
				model.KeyPos=model.KeyPos+1;
				model.Position[0]=models['auto_cube'].Position[0];
				model.Position[1]=0;
				model.Position[2]=models['auto_cube'].Position[2]-10;
				//console.log('时间：'+world.gameTime+'线'+' 位置'+model.Position)
			}
		if (this.onGround) this.Position[1] = Math.abs(matmul(this.getRotateMatrix(),this.Bound)[1]) * this.Size + world.horizon;
	}

	models['handphone'] = new Model({
		Size: 0.5,
		Rotation: [-90,0,0],
		Up: [0,0,-1],
		Direction: [0,1,0],
		dirname: './handphone/',
		needLoaded: ['ea.obj','ea.mtl'],
		onGround: false,
		hasTexture: true,
		KeyFrames:[23,33,44,54,65,76,87,98,110],
		KeyPos:0,
		Printable: false,
	});
	models['handphone'].update=function(){
		var nowTime=(Date.now()-world.startTime)/1000;
			if (nowTime>model.KeyFrames[model.KeyPos]){
				model.Printable=true;
				model.V=14;
				model.KeyPos=model.KeyPos+1;
				model.Position[0]=models['auto_cube'].Position[0]+1;
				model.Position[1]=0;
				model.Position[2]=models['auto_cube'].Position[2]-10;
				//console.log('时间：'+world.gameTime+'线'+' 位置'+model.Position)
			}
		if (this.onGround) this.Position[1] = Math.abs(matmul(this.getRotateMatrix(),this.Bound)[1]) * this.Size + world.horizon;

		this.Rotation[2]=nowTime*200;
	}

	models['loli']=new Model({
		Size:0.5,
		Position: [3, -0.4, -315],
		Rotation: [90,0,135],
		Up: [0,0,1],
		Direction: [0,1,0],
		dirname: './BunnyLoli/',
		needLoaded: ['BunnyLoli.obj','BunnyLoli.mtl'],
		onGround: true,
		hasTexture: true
	});
	
	models['sphere']=initSphere();
	models['sphere'].Printable=false;
	models['sphere'].update=function(){
		this.Position=add(world.at,[Math.sin(Date.now()/1000),0.5,Math.cos(Date.now()/1000)]);
	}
	world.update();
	render();

	canvas.onmousedown = onMouseDown;
	canvas.ontouchend = function(event){onMouseDown();event.preventDefault();};
	canvas.ontouchmove = function(event){event.preventDefault();};
	canvas.onmouseup = function(event) {
		canvas.button = undefined;
	}
	canvas.ondblclick = function(event) {
		if(!world.isRunning) {
			inform('世界','实时渲染开始');
			document.keyCode = undefined;
			world.isRunning=true;
			world.startTime+=Date.now()-world.pauseTime;
			audio.play();
			audio.onended=function(){world.isRunning=false;}
		}
		else {
			audio.pause();
			world.pauseTime=Date.now();
			world.isRunning=false;
		}
	}
	canvas.oncontextmenu = function() {
		return false;
	}

	document.onkeydown = function(event){
		if (event.keyCode==32){
			var audio=document.getElementById('music');
			if(!world.isRunning) {
				inform('世界','实时渲染开始');
				document.keyCode = undefined;
				world.isRunning=true;
				world.startTime+=Date.now()-world.pauseTime;
				audio.play();
				audio.onended=function(){world.isRunning=false;}
				clearTimeout(timer);
				render();
			}
			else {
				audio.pause();
				world.pauseTime=Date.now();
				world.isRunning=false;
			}
		}else document.keyCode = event.keyCode;
	}
	document.onkeyup = function(event){if(document.keyCode!=32)document.keyCode=undefined;}
}

function initCube(color,X) {
	var model = new Model({
		Size: 0.1,
		Position: [X, -0.4, 0],
		Rotation: [0,45,0],
		Direction: [-1,0,-1],
		KeyFrames: [0],
		KeyPos: 0,
		lastX: X,
		onGround: true,
		hasShadow: false
	});
	var points=[vec4(-1,-1,-1),vec4(-1,1,-1),vec4(-1,1,1),vec4(-1,1,1),vec4(-1,-1,1),vec4(-1,-1,-1),
	vec4(1,-1,-1),vec4(1,1,-1),vec4(1,1,1),vec4(1,1,1),vec4(1,-1,1),vec4(1,-1,-1),
	vec4(-1,-1,-1),vec4(1,-1,-1),vec4(1,-1,1),vec4(1,-1,1),vec4(-1,-1,1),vec4(-1,-1,-1),
	vec4(-1,1,-1),vec4(1,1,-1),vec4(1,1,1),vec4(1,1,1),vec4(-1,1,1),vec4(-1,1,-1),
	vec4(-1,-1,-1),vec4(1,-1,-1),vec4(1,1,-1),vec4(1,1,-1),vec4(-1,1,-1),vec4(-1,-1,-1),
	vec4(-1,-1,1),vec4(1,-1,1),vec4(1,1,1),vec4(1,1,1),vec4(-1,1,1),vec4(-1,-1,1)];
	if(color.length==undefined)var color=vec4((color>>16)/0xff,(color>>8)&0xff/0xff,(color)&0xff/0xff);
	var colors = Array(points.length).fill(color);
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer = gl.createBuffer();
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
	model.isParsed=true;
	model.update=function (){
		var nowTime=(Date.now()-world.startTime)/1000;
		if (nowTime>model.KeyFrames[model.KeyPos+1]){
			model.lastX+=world.speed*model.Direction[0]*(model.KeyFrames[model.KeyPos+1]- model.KeyFrames[model.KeyPos]);
			model.Direction[0]=-model.Direction[0];
			model.KeyPos=model.KeyPos+1;
		}
		model.Position[0]=model.lastX+world.speed*model.Direction[0]*(nowTime-model.KeyFrames[model.KeyPos])
		model.Position[2]=-world.speed*nowTime;
	}
	return model;
}

function initGround() {
	var model = new Model({
		Size: 1,
		Position: [0, world.horizon, 0],
		onGround: false,
		Selectable: false,
		hasShadow: false,
		isParsed: true,
		hasTexture: true
	});
	var P1=vec4(-0.2,0,0);
	var P2=vec4(0.2,0,0);
	var d=vec4(1,0,-1,0);
	var last_time=0;
	var temp = [P1,P2];
	var hit_time=parseMap(omr_normal_map);
	var audio=document.getElementById('music');
	hit_time.push(audio.duration);
	for(var now_time of hit_time){
		var time_delta=now_time-last_time;
		last_time=now_time;
		d[0]=-d[0];
		P1=add(P1,scale(world.speed*time_delta,d));
		P2=add(P2,scale(world.speed*time_delta,d));
		temp=temp.concat([P1,P2]);
	}
	red = vec4(0xff / 0xff, 0x00 / 0xff, 0x00 / 0xff);
	orange = vec4(0xff / 0xff, 0x80 / 0xff, 0x00 / 0xff);
	yellow = vec4(0xff / 0xff, 0xff / 0xff, 0x00 / 0xff);
	green = vec4(0x00 / 0xff, 0xff / 0xff, 0x00 / 0xff);
	indigo = vec4(0x00 / 0xff, 0xff / 0xff, 0xff / 0xff);
	blue = vec4(0x00 / 0xff, 0xff / 0xff, 0xff / 0xff);
	purple = vec4(0x80 / 0xff, 0x00 / 0xff, 0xff / 0xff);
	rainbow=[red,orange,yellow,green,indigo,blue,purple];
	points = [];
	colors = [];
	for(var i=1;i<temp.length/2;i++){
		//points=points.concat(temp.slice(i-2,i+1));
		var P1=temp[2*i-2],P2=temp[2*i-1],P3=temp[2*i],P4=temp[2*i+1];
		for(var j=1;j<7;j++){
			var P5=add(scale((8-j)/7,P1),scale((j-1)/7,P2));
			var P6=add(scale((7-j)/7,P1),scale(j/7,P2));
			var P7=add(scale((8-j)/7,P3),scale((j-1)/7,P4));
			var P8=add(scale((7-j)/7,P3),scale(j/7,P4));
			points=points.concat([P5,P6,P7,P6,P7,P8]);
		}
		for(var j=1;j<7;j++){for(var k=0;k<3;k++)colors=colors.concat(rainbow.slice(j-1,j+1));}
	}
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer = gl.createBuffer();
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
	var texcoords = [];
	for (var i = 0; i < points.length; i++) {
		texcoords.push(vec2(points[i][0],points[i][2]));
	}
	model.objects['ground']={material:'default',offset:0,pointsNumber:model.pointsNumber};
	createTexture(model,'default','../ground.jpg');
	model.texCoordBuffer=gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, model.texCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(texcoords), gl.STATIC_DRAW);
	model.update=function(){
		if(world.scene=='day')model.hasTexture=false;
		else model.hasTexture=true;
	}
	return model;
}
