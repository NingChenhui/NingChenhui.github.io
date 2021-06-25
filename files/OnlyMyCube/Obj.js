<link rel="stylesheet" class="aplayer-secondary-style-marker" href="\assets\css\APlayer.min.css"><script src="\assets\js\APlayer.min.js" class="aplayer-secondary-script-marker"></script><script class="meting-secondary-script-marker" src="\assets\js\Meting.min.js"></script>var gl;
var canvas;
var program;
var vPosition;
var vNormal;
var models = {};
var selectedModel;

function matmul(A, x) {
	B = mat4(vec4(x, 0, 0));
	B = mult(A, transpose(B));
	return transpose(B)[0].slice(0, x.length);
}

function isEmptyObject(obj){
    for (var n in obj) {
        return false
    }
    return true;
}

function clone(origin) {
  let originProto = Object.getPrototypeOf(origin);
  return Object.assign(Object.create(originProto), origin);
}

class Model {
	constructor(argv) {
		var prototype = {
			materials: {'default':{Ka:vec4(),Ka:vec4(),Ka:vec4(),Ns:30}},
			textures: {},
			vertexs: [],
			vectors: [],
			coordinates: [],
			objects: [],
			Position: [0, 0, 0],
			Rotation: [0, 0, 0],
			Direction: [0,0,1],
			Up: [0,1,0],
			Bound: [1, 1, 1],
			Size: 1,
			dirname: './简单模型/',
			needLoaded: [],
			isParsed: false,
			Selectable: true,
			Printable: true,
			onGround: true,
			hasShadow: true,
			hasMaterial: false,
			hasTexture: false
		};
		for (name in prototype) this[name] = prototype[name];
		for (name in argv) this[name] = argv[name];
		for(var filename of this.needLoaded)Ajax(this,filename);
		this.Id=1;for(var modelname in models)if(models[modelname].Id>=this.Id)this.Id=models[modelname].Id+1;
		this.Left=cross(this.Up,this.Direction);
	}
	getScalingMatrix() {
		var m = mat4();
		var size=this.Size.length?vec3(this.Size):vec3(Array(3).fill(this.Size));
		m[0][0]=size[0];
		m[1][1]=size[1];
		m[2][2]=size[2];
		m[3][3] = 1;
		return m;
	};
	getRotateMatrix() {
		return mult(rotateX(this.Rotation[0]), mult(rotateY(this.Rotation[1]), rotateZ(this.Rotation[2])));
	}
	getTranslateMatrix() {
		var m = mat4();
		m[0][3] = this.Position[0];
		m[1][3] = this.Position[1];
		m[2][3] = this.Position[2];
		return m;
	};
	getModelStateMatrix() {
		return mult(this.getTranslateMatrix(), mult(this.getRotateMatrix(), this.getScalingMatrix()));
	};
	update() {
		if (this.onGround) this.Position[1] = Math.abs(matmul(this.getRotateMatrix(),this.Bound)[1]) * this.Size + world.horizon;
	};
}

function createTexture(model,materialname,filename) {
	var image=new Image();
	image.src=model.dirname+filename;
	image.onload=function(){
		console.log(this.src);
	    var texture = gl.createTexture();
	    gl.bindTexture( gl.TEXTURE_2D, texture );
	    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image );
	    gl.generateMipmap( gl.TEXTURE_2D );
	    //gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR );
	    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
	    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
	    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
	    model.textures[materialname]=texture;
	}
}

function onMouseDown(event) {
	canvas.button = event.button;
	var selectId=getSelectId(event.clientX,canvas.height-event.clientY);
	selectedModel = undefined;
	for (name in models) {
		if(models[name].Id==selectId){
			selectedModel=models[name];
			console.log('选择物体：'+name);
		}
	}
	if (selectedModel!=undefined) {models['beacon'].Printable = true;models['beacon'].update();}
	else{
		models['beacon'].Printable = false;
		if(world.isRunning)models.cube.KeyFrames.push((Date.now()-world.startTime)/1000);
		else {
			document.keyCode = undefined;
			clearTimeout(timer);
			world.isRunning=true;
			world.startTime+=Date.now()-world.pauseTime;
			render();
			var audio=document.getElementById('music');
			audio.play();
			audio.onended=function(){world.isRunning=false;}
			inform('世界','实时渲染开始');
		}
	}
}

function Ajax(model,filename) {
	var xmlHttpReq = null;
	var ext = filename.slice(-3);
	if (window.ActiveXObject) {
		xmlHttpReq = new ActiveXObject('Microsoft.XMLHTTP');
	} else if (window.XMLHttpRequest) {
		xmlHttpReq = new XMLHttpRequest();
	}

	xmlHttpReq.open('GET', model.dirname+filename, true);
	xmlHttpReq.onreadystatechange = RequestCallBack;
	xmlHttpReq.send();

	function RequestCallBack() {
		if (xmlHttpReq.readyState === 4) {
			if (xmlHttpReq.status === 200 || xmlHttpReq.status === 0) {
				model[ext] = xmlHttpReq.responseText;
				if(model.needLoaded.length)model.needLoaded.pop(model.needLoaded.indexOf(filename));
				if (!model.needLoaded.length) parse(model);
				console.log('载入文件' + filename);
			}
		}
	}
}

function getSelectId(x,y) {
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.uniform1i(gl.getUniformLocation(program, "drawType1"),0);
	gl.uniform1i(gl.getUniformLocation(program, "drawType2"),0);
	for (modelname in models) {
		model=models[modelname];
		if (!model.Printable || !model.isParsed || !model.Selectable) continue;
		gl.uniformMatrix4fv(ModelStateMatrix, false, flatten(model.getModelStateMatrix()));
		gl.uniform4fv(gl.getUniformLocation(program, "uColor"),vec4((model.Id>>24)/0xff,(model.Id>>16)/0xff,(model.Id>>8)&0xff/0xff,(model.Id)&0xff/0xff));
		gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
		gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, model.pointsNumber);
	}
	pixels = new Uint8Array(4);
	gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	return pixels[0]<<24+pixels[1]<<16+pixels[2]<<8+pixels[3];
}

function parse(model) {
	var name;
	objects = model['objects'];
	vertexs = model['vertexs'];
	vectors = model['vectors'];
	coordinates = model['coordinates'];
	materials = model['materials'];
	for (line of model['mtl'].split('\n')) {
		if (line.startsWith('newmtl ')) {
			name = line.split(' ')[1];
			materials[name] = {};
		}
		if (line.startsWith('Ka ')) {
			temp = [];
			for (num of line.split(' ').slice(1)) temp.push(parseFloat(num));
			materials[name]['Ka'] = vec4(temp);
		}
		if (line.startsWith('Kd ')) {
			temp = [];
			for (num of line.split(' ').slice(1)) temp.push(parseFloat(num));
			materials[name]['Kd'] = vec4(temp);
		}
		if (line.startsWith('Ks ')) {
			temp = [];
			for (num of line.split(' ').slice(1)) temp.push(parseFloat(num));
			materials[name]['Ks'] = vec4(temp);
		}
		if (line.startsWith('Ns ')) {
			materials[name]['Ns'] = parseFloat(line.split(' ')[1]);
		}
		if (line.startsWith('d ')) {
			materials[name]['d'] = parseFloat(line.split(' ')[1]);
		}
		if (line.startsWith('illum ')) {
			materials[name]['illum'] = parseInt(line.split(' ')[1]);
		}
		if (line.startsWith('map_Kd ')) {
			createTexture(model,name,line.substr(7));
		}
	}
	for (line of model['obj'].split('\n')) {
		if (line.startsWith('v ')) {
			temp = [];
			for (num of line.split(' ').slice(1)) temp.push(parseFloat(num));
			vertexs.push(temp);
		}
		if (line.startsWith('vn ')) {
			temp = [];
			for (num of line.split(' ').slice(1)) temp.push(parseFloat(num));
			vectors.push(vec4(temp));
		}
		if (line.startsWith('vt ')) {
			temp = [];
			for (num of line.split(' ').slice(1)) temp.push(parseFloat(num));
			coordinates.push(vec2(temp));
		}
		if (line.startsWith('o ') || line.startsWith('g ') || line.startsWith('group ')) {
			name = line.split(' ')[1];
			if (!(name in objects)) objects[name] = {
				's': 0,
				'f': []
			};
		}
		if (line.startsWith('s ')) {
			if (line.split(' ')[1] != 'off') objects[name]['s'] = parseInt(line.split(' ')[1]);
		}
		if (line.startsWith('usemtl ')) {
			if(objects[name]['material']!=undefined && objects[name]['material'] != line.split(' ')[1]){
				name=name+'_new';
				objects[name] = {'s':0,'f':[]};
			}
			objects[name]['material'] = line.split(' ')[1];
		}
		if (line.startsWith('f ')) {
			temp = [];
			for (num of line.split(' ').slice(1))temp.push([Number(num.split('/')[0]),Number(num.split('/')[1]),Number(num.split('/')[2])]);
			objects[name]['f'].push(temp);
		}
	}
	maxPos = [-Math.tan(Math.PI / 2), -Math.tan(Math.PI / 2), -Math.tan(Math.PI / 2)];
	minPos = [Math.tan(Math.PI / 2), Math.tan(Math.PI / 2), Math.tan(Math.PI / 2)];
	for (x of vertexs) {
		for (var i = 0; i < 3; i++) {
			if (x[i] < minPos[i]) minPos[i] = x[i];
			if (x[i] > maxPos[i]) maxPos[i] = x[i];
		}
	}
	maxBound = [(maxPos[0] - minPos[0]) / 2, (maxPos[1] - minPos[1]) / 2, (maxPos[2] - minPos[2]) / 2];
	maxSize = Math.max(maxBound[0], maxBound[1], maxBound[2]);
	midPos = [(maxPos[0] + minPos[0]) / 2, (maxPos[1] + minPos[1]) / 2, (maxPos[2] + minPos[2]) / 2];
	for (i in vertexs) {
		vertexs[i] = vec4((vertexs[i][0] - midPos[0]) / maxSize, (vertexs[i][1] - midPos[1]) / maxSize, (vertexs[i][2] - midPos[2]) / maxSize);
	}
	model.Bound = [maxBound[0] / maxSize, maxBound[1] / maxSize, maxBound[2] / maxSize];
	console.log('渲染模型' + model);
	var points = [];
	var normals = [];
	var texcoords = [];
	model.pointsNumber=0;
	for (name in model.objects) {
		console.log('渲染' + name);
		part = objects[name];
		if(part.material==undefined||!(part.material in model.materials))part.material='default';
		part.Ka = model.materials[part.material]['Ka']?model.materials[part.material]['Ka']:vec4(0, 0, 0);
		part.Kd = model.materials[part.material]['Kd']?model.materials[part.material]['Kd']:vec4(0, 0, 0);
		part.Ks = model.materials[part.material]['Ks']?model.materials[part.material]['Ks']:vec4(0, 0, 0);
		part.Ns = model.materials[part.material]['Ns']?model.materials[part.material]['Ns']:30;
		for (indexs of part['f']) {
			for (var i = 0; i < indexs.length; i++) {
				for(var j=0;j<3;j++){
					if (indexs[i][j] < 0) indexs[i][j] += vertexs.length;
					else indexs[i][j] -= 1;
				}
			}
			for (var i = 2; i < indexs.length; i++) {
				points = points.concat([vertexs[indexs[0][0]], vertexs[indexs[i - 1][0]], vertexs[indexs[i][0]]]);
				if(model.hasTexture)texcoords = texcoords.concat([coordinates[indexs[0][1]], coordinates[indexs[i - 1][1]], coordinates[indexs[i][1]]]);
				if(model.hasMaterial)normals = normals.concat([vectors[indexs[0][2]], vectors[indexs[i - 1][2]], vectors[indexs[i][2]]]);
			}
			if(!model.hasMaterial)normals = normals.concat(Array((indexs.length - 2) * 3).fill(part.Kd));
		}
		part.offset=model.pointsNumber;
		part.pointsNumber=points.length-model.pointsNumber;
		model.pointsNumber=points.length;
	}
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer = gl.createBuffer();
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
	if(model.hasTexture){
		model.texCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, flatten(texcoords), gl.STATIC_DRAW);
	}
	model.isParsed = true;
}

function render() {
	if(models.cube&&models.cube1&&models.cube2){
		var lose=Math.abs(models.cube.Position[0]-models.auto_cube.Position[0])>2-0.2*Math.sqrt(2);
		if(lose){
			document.getElementById('music').pause();
			world.isRunning=false;
		}
	}
	//else console.log([lose,Math.abs(models.cube.Position[0]-models.cube1.Position[0])]);
	if(keymap[document.keyCode]=='Space'){inform('世界','实时渲染暂停');document.keyCode=undefined;return;}
	if (canvas.width != window.innerWidth || canvas.height != window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
		console.log('画布大小重置：' + canvas.width + ',' + canvas.height);
	}
	gl.clearColor(0x66 / 0xff, 0xcc / 0xff, 0xff / 0xff, 1.0);//gl.clearColor(0xdd / 0xff, 0xdd / 0xff, 0xdd / 0xff, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.uniformMatrix4fv(ModelViewMatrix, false, flatten(world.getModelViewMatrix()));
	gl.uniformMatrix4fv(ProjectionMatrix, false, flatten(world.getProjectionMatrix()));
	gl.uniform4fv(gl.getUniformLocation(program, "lightAmbient"), flatten(world.lightAmbient));
	gl.uniform4fv(gl.getUniformLocation(program, "lightDiffuse"), flatten(world.lightDiffuse));
	gl.uniform4fv(gl.getUniformLocation(program, "lightSpecular"), flatten(world.lightSpecular));
	gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(world.lightPosition));
	gl.uniform4fv(gl.getUniformLocation(program, "eye"), flatten(vec4(world.eye)));
	if(world.isRunning){models.sky.update();models.sun.update();}
	if(selectedModel)models.beacon.update();
	for (modelname in models) {
		model=models[modelname];
		if (!model||!model.isParsed) continue;
		if(model.Printable){drawObj(model);}
		if(world.isRunning)model.update();
	}
	if(world.isRunning){
		world.update();
		requestAnimationFrame(render);
	}
	else{
		timer=setTimeout(render,1000);
	}
	if(lose)requestAnimationFrame(function (){
		alert('菜！');
		var hit_time=[0].concat(parseMap(omr_normal_map));
		document.getElementById('music').currentTime=0;
		models['auto_cube']=initCube(0xffffff,0);
		models['auto_cube'].KeyFrames=hit_time;
		models['auto_cube'].Printable=false;
		models['cube']=initCube(0x00ff00,0);
		models['cube1']=initCube(0xff0000,-2);
		models['cube1'].KeyFrames=hit_time;
		models['cube2']=initCube(0x0000ff,2);
		models['cube2'].KeyFrames=hit_time;
		if(models.sky)models['sky'].Printable=false;
		if(models.loli)models['loli'].Printable=false;
		if(models.sphere)models['sphere'].Printable=false;
		world.lineNum=prepareLine();//add 
		world.startTime=0;
		world.keyPos=0;
		world.ProjectionType='ortho';
		world.eye[1]=1;
		world.R=0.001;
		world.theta=Math.PI / 2;
		world.update();
	});
}

function drawObj(model) {
	if(model.hasTexture)drawType=3;
	else if(model.hasMaterial)drawType=2;
	else drawType=1;
	gl.uniform1i(gl.getUniformLocation(program, "drawType1"),drawType);
	gl.uniform1i(gl.getUniformLocation(program, "drawType2"),drawType);
	gl.uniformMatrix4fv(ModelStateMatrix, false, flatten(model.getModelStateMatrix()));
	if(model.hasTexture)gl.enableVertexAttribArray(vTexCoord);
	gl.enableVertexAttribArray(vNormal);
	if(!isEmptyObject(model.objects)){
		for(name in model.objects)
		{
			var part=model.objects[name];
			if(model.hasMaterial){
				gl.uniform4fv(gl.getUniformLocation(program, "materialAmbient"),flatten(part.Ka));
				gl.uniform4fv(gl.getUniformLocation(program, "materialDiffuse"),flatten(part.Kd));
				gl.uniform4fv(gl.getUniformLocation(program, "materialSpecular"),flatten(part.Ks));
				gl.uniform1f(gl.getUniformLocation(program, "shininess"),part.Ns);
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
			gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, part.offset*4*4);
			gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
			gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 0, part.offset*4*4);
			if(model.hasTexture){
				gl.bindTexture(gl.TEXTURE_2D, model.textures[part.material]);
				gl.bindBuffer(gl.ARRAY_BUFFER, model.texCoordBuffer);
				gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0,  part.offset*4*2);
			}
			gl.drawArrays(gl.TRIANGLES, 0, part.pointsNumber);
		}
	}
	else{
		gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
		gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
		gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, model.pointsNumber);
	}
	gl.disableVertexAttribArray(vNormal);
	gl.disableVertexAttribArray(vTexCoord);
	if(model.hasShadow){
		gl.uniform1i(gl.getUniformLocation(program, "drawType1"),0);
		gl.uniform1i(gl.getUniformLocation(program, "drawType2"),0);
		gl.uniformMatrix4fv(ModelStateMatrix, false, flatten(mult(world.getShadowMatrix(),model.getModelStateMatrix())));
		gl.uniform4fv(gl.getUniformLocation(program, "uColor"),vec4());
		gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
		gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, model.pointsNumber);
	}
}

function initSphere() {
	var N = 10;
	var points = [];
	var colors = [];
	var model = new Model({
		Size: 0.075,
		Position: [0, -0.2, 5],
		onGround: false,
		isParsed: true
	});
	for (var j = -N; j <= N; j++) {
		var phi = j * Math.PI / 2 / N;
		var M = Math.ceil(Math.cos(phi) * 10) + 10;
		for (var i = -M; i <= M; i++) {
			var theta = i * Math.PI / M;
			A = vec4(Math.cos(theta) * Math.cos(phi), Math.sin(theta) * Math.cos(phi), Math.sin(phi));
			B = vec4(Math.cos(theta) * Math.cos(phi + Math.PI / 2 / N), Math.sin(theta) * Math.cos(phi + Math.PI / 2 / N), Math.sin(phi + Math.PI / 2 / N));
			C = vec4(Math.cos(theta + Math.PI / M) * Math.cos(phi), Math.sin(theta + Math.PI / M) * Math.cos(phi), Math.sin(phi));
			D = vec4(Math.cos(theta + Math.PI / M) * Math.cos(phi + Math.PI / 2 / N), Math.sin(theta + Math.PI / M) * Math.cos(phi + Math.PI / 2 / N), Math.sin(phi + Math.PI / 2 / N));
			points = points.concat([A, B, C, B, C, D]);
			if (j > 25 / 30 * N) color = vec4(1, 1, 1);
			else if (j > 23 / 30 * N) color = vec4(0.2, 0, 0);
			else if (i >= 0) color = vec4(0.8, 0, 0);
			else color = vec4(0.9, 1, 0.9);
			colors = colors.concat(Array(6).fill(color));
		}
	}
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer = gl.createBuffer();
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
	return model;
}

function initSun() {
	var N = 10;
	var points = [];
	var colors = [];
	var model = new Model({
		Size: 0.1,
		Position: vec3(world.lightPosition),
		Rotation: [90,0,0],
		onGround: false,
		isParsed: true,
		hasShadow: false
	});
	for (var j = -N; j <= N; j++) {
		var phi = j * Math.PI / 2 / N;
		var M = Math.ceil(Math.cos(phi) * 10) + 10;
		for (var i = -M; i <= M; i++) {
			var theta = i * Math.PI / M;
			A = vec4(Math.cos(theta) * Math.cos(phi), Math.sin(theta) * Math.cos(phi), Math.sin(phi));
			B = vec4(Math.cos(theta) * Math.cos(phi + Math.PI / 2 / N), Math.sin(theta) * Math.cos(phi + Math.PI / 2 / N), Math.sin(phi + Math.PI / 2 / N));
			C = vec4(Math.cos(theta + Math.PI / M) * Math.cos(phi), Math.sin(theta + Math.PI / M) * Math.cos(phi), Math.sin(phi));
			D = vec4(Math.cos(theta + Math.PI / M) * Math.cos(phi + Math.PI / 2 / N), Math.sin(theta + Math.PI / M) * Math.cos(phi + Math.PI / 2 / N), Math.sin(phi + Math.PI / 2 / N));
			points = points.concat([A, B, C, B, C, D]);
		}
	}
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer1 = gl.createBuffer();
	model.normalBuffer2 = gl.createBuffer();
	model.normalBuffer3 = gl.createBuffer();
	model.normalBuffer=model.normalBuffer3;
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer1);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(Array(model.pointsNumber).fill(vec4(1,0,0))), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer2);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(Array(model.pointsNumber).fill(vec4(0,0,1))), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer3);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(Array(model.pointsNumber).fill(vec4(1,1,0))), gl.STATIC_DRAW);
	model.getRotateMatrix=function() {
		return mult(rotateX(this.Rotation[0]), mult(rotateY(this.Rotation[1]), rotateZ(this.Rotation[2])));
	}
	model.update=function () {
		model.Rotation[1] += (Date.now()-world.time)/12;
		model.Position=add(world.at,[Math.sin((Date.now()-world.startTime)/1000),1,-1]);
		world.lightPosition=vec4(model.Position);
	}
	return model;
}

function initSky() {
	var model = new Model({
		Size: 100,
		Position: [0, 0, -20],
		onGround: false,
		Selectable: false,
		hasTexture: true,
		hasShadow: false,
		Printable: false
	});
	var points = [vec4(-1,-1,0),vec4(-1,1,0),vec4(1,1,0),vec4(-1,-1,0),vec4(1,-1,0),vec4(1,1,0)];
	var texcoords = [];
	var k=0.5;
	for (var i = 0; i < points.length; i++) {
		texcoords.push(vec2((points[i][0]+1)*k,(points[i][1]+1)*k));
	}
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer = gl.createBuffer();
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(Array(model.pointsNumber).fill(vec4(0,0,1))), gl.STATIC_DRAW);
	model.objects['sky']={material:'day',offset:0,pointsNumber:model.pointsNumber};
	createTexture(model,'night','../star.jpg');
	createTexture(model,'day','../cloud.jpg');
	model.texCoordBuffer=gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, model.texCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(texcoords), gl.STATIC_DRAW);
	model.getModelStateMatrix=function(){return mult(inverse4(world.getModelViewMatrix()),mult(this.getTranslateMatrix(), mult(this.getRotateMatrix(), this.getScalingMatrix())));}
	model.update=function(){
		if(world.ProjectionType=='ortho'){
			//model.Position=subtract(world.at,[20*Math.cos(world.theta),0,20*Math.sin(world.theta)]);
			model.Size=[10,5,5];
		}
		else{
			//model.Position=subtract(world.at,[-30*Math.cos(world.theta),world.eye[1]-world.at[1],30*Math.sin(world.theta)]);
			if(canvas.width>2*canvas.height)model.Size=scale(canvas.width/1280,[40,20,20]);
			else model.Size=scale(canvas.height/1280,[40,20,20]);
		}
	}
	model.isParsed=true;
	return model;
}


//Sinki
function initTetrahedron() {
	var model = new Model({
		Size: 0.1,
		onGround: false,
		isParsed: true,
		Selectable: false,
		Printable: false,
		hasShadow: false
	});
	var points = [];
	var colors = [];
	var basevertices = [
		vec4(0.0000, -1.0000, 0.0000),
		vec4(0.9428, 0.3333, 0.0000),
		vec4(-0.4714, 0.3333, -0.8165),
		vec4(-0.4714, 0.3333, 0.8165)
	];

	var basecolors_tetrahedron = [
		vec4(1.0, 0.0, 0.0, 1.0),
		vec4(0.0, 1.0, 0.0, 1.0),
		vec4(0.0, 0.0, 1.0, 1.0),
		vec4(0.5, 0.5, 0.5, 1.0)
	];

	function triangle(a, b, c, color) {
		colors.push(basecolors_tetrahedron[color]);
		points.push(a);
		colors.push(basecolors_tetrahedron[color]);
		points.push(b);
		colors.push(basecolors_tetrahedron[color]);
		points.push(c);
	}

	function tetra(a, b, c, d) {
		triangle(a, c, b, 0);
		triangle(a, c, d, 1);
		triangle(a, b, d, 2);
		triangle(b, c, d, 3);
	}
	tetra(basevertices[0], basevertices[1], basevertices[2], basevertices[3]);
	model.pointBuffer = gl.createBuffer();
	model.normalBuffer = gl.createBuffer();
	model.pointsNumber = points.length;
	gl.bindBuffer(gl.ARRAY_BUFFER, model.pointBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
	model.update = function() {
		if(selectedModel)model.Position = add(selectedModel.Position, [0, 0.2 +  Math.abs(matmul(selectedModel.getRotateMatrix(),selectedModel.Bound)[1])*selectedModel.Size, 0]);
		model.Rotation[1] += (Date.now()-world.time)/6;
	}
	return model;
}