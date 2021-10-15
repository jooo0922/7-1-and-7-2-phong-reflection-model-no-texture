"use strict";

let gl, canvas;
let pwgl = {};

function createGLContext(canvas) {
  const names = ["webgl", "experimental-webgl"];
  let context = null;

  for (let i = 0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch (error) {}

    if (context) {
      break;
    }
  }

  if (context) {
    // 예제 원문에서 사용하는 코드는 안티패턴이므로 작성하지 않도록 함.
  } else {
    alert("Failed to create WebGL context!");
  }

  return context;
}

function loadShaderFromDOM(id) {
  const shaderScript = document.getElementById(id);

  if (!shaderScript) {
    return null;
  }

  let shaderSource = "";
  let currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType === 3) {
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  let shader;
  if (shaderScript.type === "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type === "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (
    !gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
    !gl.isContextLost()
  ) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

function setupShaders() {
  const vertexShader = loadShaderFromDOM("shader-vs");
  const fragmentShader = loadShaderFromDOM("shader-fs");

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (
    !gl.getProgramParameter(shaderProgram, gl.LINK_STATUS) &&
    !gl.isContextLost()
  ) {
    alert("Failed to setup shaders: " + gl.getProgramInfoLog(shaderProgram));
  }

  gl.useProgram(shaderProgram);

  // gl.getAttribLocation()을 이용해서 셰이더 내의 애트리뷰트 변수들의 제네릭 애트리뷰트 인덱스를 받아온 뒤, 전역 객체인 pwgl에 저장함.
  pwgl.vertexPositionAttributeLoc = gl.getAttribLocation(
    shaderProgram,
    "aVertexPosition"
  );
  pwgl.vertexNormalAttributeLoc = gl.getAttribLocation(
    shaderProgram,
    "aVertexNormal"
  );

  //  gl.getUniformLocation()을 이용해서 셰이더 내의 유니폼 변수들의 WebGLUniformLocation 객체를 받아온 뒤, 전역 객체인 pwgl에 저장함.
  pwgl.uniformMVMatrixLoc = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  pwgl.uniformProjMatrixLoc = gl.getUniformLocation(shaderProgram, "uPMatrix");
  pwgl.uniformNormalMatrixLoc = gl.getUniformLocation(
    shaderProgram,
    "uNMatrix"
  );
  pwgl.uniformLightPositionLoc = gl.getUniformLocation(
    shaderProgram,
    "uLightPosition"
  );
  pwgl.uniformAmbientLightColorLoc = gl.getUniformLocation(
    shaderProgram,
    "uAmbientLightColor"
  );
  pwgl.uniformDiffuseLightColorLoc = gl.getUniformLocation(
    shaderProgram,
    "uDiffuseLightColor"
  );
  pwgl.uniformSpecularLightColorLoc = gl.getUniformLocation(
    shaderProgram,
    "uSpecularLightColor"
  );

  // 버텍스 좌표 데이터와 각 버텍스의 노말 벡터 데이터를 쏴줄 각 애트리뷰트 변수들을 활성화함.
  // 왜냐면, 얘내들은 상수 버텍스 데이터가 아니라 WebGLBuffer에 기록된 데이터 배열로 쏴줄거니까
  gl.enableVertexAttribArray(pwgl.vertexPositionAttributeLoc);
  gl.enableVertexAttribArray(pwgl.vertexNormalAttributeLoc);

  // 모델뷰행렬, 투영행렬을 위한 4*4 빈 행렬 및 모델뷰행렬 스택을 만들어 둠
  pwgl.modelViewMatrix = mat4.create();
  pwgl.projectionMatrix = mat4.create();
  pwgl.modelViewMatrixStack = [];
}

function setupFloorBuffers() {
  // gl.drawElements()로 바닥을 그릴 때 사용할 버텍스 위치 데이터 WebGLBuffer 생성
  pwgl.floorVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.floorVertexPositionBuffer); // 어떤 WebGLBuffer에 gl.bufferData()로 기록할건지 바인딩함.

  const floorVertexPosition = [
    // y좌표값(높이)가 0인 4개의 버텍스 좌표를 기록해 둠.
    5.0,
    0.0,
    5.0, //v0
    5.0,
    0.0,
    -5.0, //v1
    -5.0,
    0.0,
    -5.0, //v2
    -5.0,
    0.0,
    5.0, // v3
  ]; // 버텍스 셰이더에서 투영 변환하여 클립좌표(-1.0 ~ 1.0)로 변환해 줌. 굳이 버텍스 데이터를 클립좌표로 안넣어도 됨.

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(floorVertexPosition),
    gl.STATIC_DRAW
  );

  pwgl.FLOOR_VERTEX_POS_BUF_ITEM_SIZE = 3; // 버텍스 하나 당 필요한 좌표값 수
  pwgl.FLOOR_VERTEX_POS_BUF_NUM_ITEMS = 4; // 총 버텍스 수

  // 바닥을 그릴 때, 버텍스 셰이더에서 각 버텍스의 밝기값 계산에 필요한 노멀 벡터 데이터를 저장해 둘 WebGLBuffer 생성
  pwgl.floorVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.floorVertexNormalBuffer);

  const floorVertexNormals = [
    0.0,
    1.0,
    0.0, // v0
    0.0,
    1.0,
    0.0, // v1
    0.0,
    1.0,
    0.0, // v2
    0.0,
    1.0,
    0.0, // v3
  ]; // 바닥면은 양의 y축에 수직이고, 양의 y축으로 향하고 있으므로, 바닥면의 모든 버텍스는 (0.0, 1.0, 0.0)을 노말 벡터로 가짐.

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(floorVertexNormals),
    gl.STATIC_DRAW
  );

  pwgl.FLOOR_VERTEX_NORMAL_BUF_ITEM_SIZE = 3; // 버텍스 하나 당 필요한 노멀 데이터 수
  pwgl.FLOOR_VERTEX_NORMAL_NUM_ITEMS = 4; // 총 버텍스 수

  // gl.drawElements()로 바닥을 그릴 때 사용할 버텍스 인덱스를 기록할 WebGLBuffer 생성
  pwgl.floorVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pwgl.floorVertexIndexBuffer);

  const floorVertexIndices = [0, 1, 2, 3];

  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(floorVertexIndices),
    gl.STATIC_DRAW
  );

  pwgl.FLOOR_VERTEX_INDEX_BUF_ITEM_SIZE = 1; // 버텍스 하나를 가리키는 인덱스 수. 딱히 예제에서 사용 안함.
  pwgl.FLOOR_VERTEX_INDEX_BUF_NUM_ITEMS = 4; // 총 (버텍스를 가리키는)인덱스 수
}

function setupCubeBuffers() {
  // 큐브의 버텍스 위치 데이터를 담을 WebGLBuffer 생성
  pwgl.cubeVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.cubeVertexPositionBuffer);

  const cubeVertexPosition = [
    // Front face
    1.0,
    1.0,
    1.0, //v0
    -1.0,
    1.0,
    1.0, //v1
    -1.0,
    -1.0,
    1.0, //v2
    1.0,
    -1.0,
    1.0, //v3

    // Back face
    1.0,
    1.0,
    -1.0, //v4
    -1.0,
    1.0,
    -1.0, //v5
    -1.0,
    -1.0,
    -1.0, //v6
    1.0,
    -1.0,
    -1.0, //v7

    // Left face
    -1.0,
    1.0,
    1.0, //v8
    -1.0,
    1.0,
    -1.0, //v9
    -1.0,
    -1.0,
    -1.0, //v10
    -1.0,
    -1.0,
    1.0, //v11

    // Right face
    1.0,
    1.0,
    1.0, //12
    1.0,
    -1.0,
    1.0, //13
    1.0,
    -1.0,
    -1.0, //14
    1.0,
    1.0,
    -1.0, //15

    // Top face
    1.0,
    1.0,
    1.0, //v16
    1.0,
    1.0,
    -1.0, //v17
    -1.0,
    1.0,
    -1.0, //v18
    -1.0,
    1.0,
    1.0, //v19

    // Bottom face
    1.0,
    -1.0,
    1.0, //v20
    1.0,
    -1.0,
    -1.0, //v21
    -1.0,
    -1.0,
    -1.0, //v22
    -1.0,
    -1.0,
    1.0, //v23
  ]; // 1.0 ~ -1.0 사이의 좌표값만 넣어줬지만, 이거는 클립좌표 기준으로 넣어준 게 절대 아님!! -> 즉, 버텍스 셰이더에서 투명 변환 해줘서 이 값들이 더 작은 값으로 변할거라는 뜻!

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(cubeVertexPosition),
    gl.STATIC_DRAW
  );

  pwgl.CUBE_VERTEX_POS_BUF_ITEM_SIZE = 3; // 버텍스 하나 당 필요한 좌표값 수
  pwgl.CUBE_VERTEX_POS_BUF_NUM_ITEMS = 24; // 총 버텍스 수 (큐브는 꼭지점 하나 당 3면이 이웃하고, 각 면마다 서로 다른 버텍스 데이터를 넘겨주고 싶기 때문에 8개의 꼭지점 * 3면 = 24개가 나온 것)

  // 큐브을 그릴 때, 버텍스 셰이더에서 각 버텍스의 밝기값 계산에 필요한 노멀 벡터 데이터를 저장해 둘 WebGLBuffer 생성
  pwgl.cubeVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.cubeVertexNormalBuffer);

  const cubeVertexNormals = [
    // Front face
    0.0,
    0.0,
    1.0, //v0
    0.0,
    0.0,
    1.0, //v1
    0.0,
    0.0,
    1.0, //v2
    0.0,
    0.0,
    1.0, //v3

    // Back face
    0.0,
    0.0,
    -1.0, //v4
    0.0,
    0.0,
    -1.0, //v5
    0.0,
    0.0,
    -1.0, //v6
    0.0,
    0.0,
    -1.0, //v7

    // Left face
    -1.0,
    0.0,
    0.0, //v8
    -1.0,
    0.0,
    0.0, //v9
    -1.0,
    0.0,
    0.0, //v10
    -1.0,
    0.0,
    0.0, //v11

    // Right face
    1.0,
    0.0,
    0.0, //12
    1.0,
    0.0,
    0.0, //13
    1.0,
    0.0,
    0.0, //14
    1.0,
    0.0,
    0.0, //15

    // Top face
    0.0,
    1.0,
    0.0, //v16
    0.0,
    1.0,
    0.0, //v17
    0.0,
    1.0,
    0.0, //v18
    0.0,
    1.0,
    0.0, //v19

    // Bottom face
    0.0,
    -1.0,
    0.0, //v20
    0.0,
    -1.0,
    0.0, //v21
    0.0,
    -1.0,
    0.0, //v22
    0.0,
    -1.0,
    0.0, //v23
  ]; // 큐브에서는, 각 면의 노멀 데이터는 서로 다르지만, 같은 면을 공유하는 버텍스들은 노멀 데이터가 서로 같다! (하단 노멀 벡터 관련 정리 참고)

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(cubeVertexNormals),
    gl.STATIC_DRAW
  );

  pwgl.CUBE_VERTEX_NORMAL_BUF_ITEM_SIZE = 3; // 버텍스 하나 당 필요한 노멀 데이터 수
  pwgl.CUBE_VERTEX_NORMAL_BUF_NUM_ITEMS = 24; // 총 버텍스 수

  // gl.drawElements() 메서드로 큐브를 그릴 때 사용할 버텍스 인덱스를 기록할 WebGLBuffer 생성
  pwgl.cubeVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pwgl.cubeVertexIndexBuffer);

  const cubeVertexIndices = [
    0,
    1,
    2,
    0,
    2,
    3, // Front face
    4,
    6,
    5,
    4,
    7,
    6, // Back face
    8,
    9,
    10,
    8,
    10,
    11, // Left face
    12,
    13,
    14,
    12,
    14,
    15, // Right face
    16,
    17,
    18,
    16,
    18,
    19, // Top face
    20,
    22,
    21,
    20,
    23,
    22, // Bottom face
  ];

  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(cubeVertexIndices),
    gl.STATIC_DRAW
  );

  pwgl.CUBE_VERTEX_INDEX_BUF_ITEM_SIZE = 1;
  pwgl.CUBE_VERTEX_INDEX_BUF_NUM_ITEMS = 36; // 총 인덱스 수 (24개의 버텍스를 36번의 인덱스 호출로 큐브를 만듦.)
}

function setupBuffers() {
  setupFloorBuffers();
  setupCubeBuffers();
}

// 빛에 관한 정보를 버텍스 셰이더의 각 유니폼 변수로 업로드해주는 함수
function setupLights() {
  // uploadProjectionMatrixToShader(), uploadNormalMatrixToShader() 함수에서
  // 수정된 변환 행렬을 버텍스 셰이더로, mat4 타입의 유니폼 변수에 업로드하기 위해 gl.uniformMatrix4fv() 메서드를 사용하는 것처럼,
  // 버텍스 셰이더에 vec3 타입의 유니폼 변수에 업로드하고 싶다면, gl.uniform3fv(WebGLUniformLocation, 3개의 성분으로 구성된 빛 정보 배열) 을 사용하면 됨.
  // 이 메서드를 사용하면 유니폼 변수에 필요한 값 (두 번째 인자)를 GPU로 전송해 줌.
  gl.uniform3fv(pwgl.uniformLightPositionLoc, [0.0, 20.0, 0.0]); // 빛(광원)의 위치 데이터
  gl.uniform3fv(pwgl.uniformAmbientLightColorLoc, [0.2, 0.2, 0.2]); // 앰비언트 광원 성분 * 앰비언트 재질 특성을 사전에 곱한 값
  gl.uniform3fv(pwgl.uniformDiffuseLightColorLoc, [0.7, 0.7, 0.7]); // 디퓨즈 광원 성분 * 디퓨즈 재질 특성을 사전에 곱한 값
  gl.uniform3fv(pwgl.uniformSpecularLightColorLoc, [0.8, 0.8, 0.8]); // 스펙큘러 광원 성분 * 스펙큘러 재질 특성을 사전에 곱한 값

  /**
   * 각각의 유니폼 변수에 대한 설명은
   * index.html 하단에 정리해 놓았으니 참고할 것.
   */
}

function uploadModelViewMatrixToShader() {
  // gl.uniformMatrix4fv() 메서드로 버텍스 셰이더의 uMVMatrix 유니폼 변수에
  // 초기화 또는 수정된 modelViewMatrix를 업로드함.
  gl.uniformMatrix4fv(pwgl.uniformMVMatrixLoc, false, pwgl.modelViewMatrix);
}

function uploadProjectionMatrixToShader() {
  // gl.uniformMatrix4fv() 메서드로 버텍스 셰이더의 uPMatrix 유니폼 변수에
  // 초기화된 modelViewMatrix를 업로드함.
  gl.uniformMatrix4fv(pwgl.uniformProjMatrixLoc, false, pwgl.projectionMatrix);
}

// 버텍스 좌표와는 다르게, 버텍스 노멀을 눈 좌표계로 변환하려면 모델뷰행렬 가지고는 안됨.
// 따라서, 모델뷰행렬을 이용해서 만드는 어떠한 특별한 행렬이 필요한데, 그걸 만들어서 버텍스 셰이더에 쏴주는 함수
function uploadNormalMatrixToShader() {
  // 모델뷰행렬의 상단 3*3 역전치 행렬(이게 위에서 말한 특별한 행렬...)을 만들어 줌.
  const normalMatrix = mat3.create(); // 역전치 행렬을 만들어 줄 비어있는 3*3 행렬 생성
  mat4.toInverseMat3(pwgl.modelViewMatrix, normalMatrix); // 모델뷰행렬의 상단 3*3 행렬의 역행렬로 변환하여 결과값을 normalMatrix에 할당해 줌.
  mat3.transpose(normalMatrix); // 모델뷰행렬의 상단 3*3 역행렬(normalMatrix)을 전치시켜서 3*3 역전치 행렬로 만들어 줌.

  // 위에 uploadModelViewMatrixToShader 등과 같은 함수들처럼, 특별한 행렬을 다 만들었으면
  // 버텍스 셰이더의 uNMatrix 유니폼 변수에 초기화한 normalMatrix를 업로드함.
  // 이때, 4*4 아니고, 3*3 행렬을 전송하는 거니까 gl.uniformMatrix3fv() 메서드를 사용해야 함.
  gl.uniformMatrix3fv(pwgl.uniformNormalMatrixLoc, false, normalMatrix);
}

// 바닥을 그리는 함수
function drawFloor() {
  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.floorVertexPositionBuffer); // WebGLBuffer 위치 버퍼 바인딩
  gl.vertexAttribPointer(
    pwgl.vertexPositionAttributeLoc,
    pwgl.FLOOR_VERTEX_POS_BUF_ITEM_SIZE,
    gl.FLOAT,
    false,
    0,
    0
  ); // pwgl.floorVertexPositionBuffer에 기록된 버텍스 데이터를 aVertexPosition으로 가져올 방법을 정의함.

  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.floorVertexNormalBuffer); // WebGLBuffer 노말 버퍼 바인딩
  gl.vertexAttribPointer(
    pwgl.vertexNormalAttributeLoc,
    pwgl.FLOOR_VERTEX_NORMAL_BUF_ITEM_SIZE,
    gl.FLOAT,
    false,
    0,
    0
  ); // pwgl.floorVertexNormalBuffer에 기록된 버텍스 노멀 데이터를 aVertexNormal로 전달할 방법을 정의함.

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pwgl.floorVertexIndexBuffer); // gl.drawElements() 메서드가 엘레먼트 배열 버퍼를 사용하려면, 먼저 해당 WebGLBuffer를 바인딩해줘야 함.
  gl.drawElements(
    gl.TRIANGLE_FAN,
    pwgl.FLOOR_VERTEX_INDEX_BUF_NUM_ITEMS,
    gl.UNSIGNED_SHORT,
    0
  );
}

// 현재의 모델뷰행렬을 복사한 뒤, 복사본을 모델뷰행렬 스택에 push해놓는 함수
function pushModelViewMatrix() {
  const copyToPush = mat4.create(pwgl.modelViewMatrix);
  pwgl.modelViewMatrixStack.push(copyToPush);
}

// 가장 최근에 스택에 저장된 모델뷰행렬을 가져와 현재의 모델뷰행렬로 복구시키는 함수.
function popModelViewMatrix() {
  if (pwgl.modelViewMatrixStack.length === 0) {
    // 만약 모델뷰행렬 스택이 비어있다면, 에러 메시지를 생성하고 프로그램을 중단함.
    // -> why? throw 연산자는 try...catch 블록 내에서 사용되지 않으면 예외 발생 시 스크립트가 죽어버림.
    throw "Error popModelViewMatrix() - Stack was empty";
  }

  // pop() 메서드는 가장 마지막 item을 리턴해줌과 동시에 스택에서 마지막 item을 자동으로 제거해 줌.
  pwgl.modelViewMatrix = pwgl.modelViewMatrixStack.pop();
}

// 변형된 모델뷰행렬을 적용해서 다양한 크기와 모양의 큐브를 그리는 함수
function drawCube() {
  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.cubeVertexPositionBuffer); // gl.vertexAttribPointer()로 어떤 WebGLBuffer에서 버텍스 데이터를 가져갈건지 정하기 위한 바인딩.
  gl.vertexAttribPointer(
    pwgl.vertexPositionAttributeLoc,
    pwgl.CUBE_VERTEX_POS_BUF_ITEM_SIZE,
    gl.FLOAT,
    false,
    0,
    0
  ); // cubeVertexPositionBuffer에 기록된 버텍스 데이터를 aVertexPosition으로 가져올 방법을 정의함.

  gl.bindBuffer(gl.ARRAY_BUFFER, pwgl.cubeVertexNormalBuffer); // 버텍스 노멀 데이터가 담긴 WebGLBuffer에서 노멀 데이터를 가져오기 위해 바인딩.
  gl.vertexAttribPointer(
    pwgl.vertexNormalAttributeLoc,
    pwgl.CUBE_VERTEX_NORMAL_BUF_ITEM_SIZE,
    gl.FLOAT,
    false,
    0,
    0
  ); // pwgl.cubeVertexNormalBuffer에 기록된 버텍스 노멀 데이터를 aVertexNormal로 가져올 방법 지정함.

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pwgl.cubeVertexIndexBuffer); // gl.drawElements() 메서드가 엘레먼트 배열 버퍼를 사용하려면, 먼저 해당 WebGLBuffer를 바인딩해줘야 함.
  gl.drawElements(
    gl.TRIANGLES,
    pwgl.CUBE_VERTEX_INDEX_BUF_NUM_ITEMS,
    gl.UNSIGNED_SHORT,
    0
  );
}

function drawTable() {
  // 테이블 윗면 그리기
  pushModelViewMatrix(); // draw() 함수에서 이동변환이 적용된 모델뷰행렬을 또 저장함. -> drawTable() 함수 안에서만 계속 복구해서 사용할거임.
  mat4.translate(pwgl.modelViewMatrix, [0.0, 1.0, 0.0], pwgl.modelViewMatrix); // y축으로 올려주는 이동변환 적용
  mat4.scale(pwgl.modelViewMatrix, [2.0, 0.1, 2.0], pwgl.modelViewMatrix); // 테이블 윗면은 얇으면서 넓은 모양이 되도록 스케일 변환 적용
  uploadModelViewMatrixToShader(); // 모델뷰행렬이 바뀌면 버텍스 셰이더에 재업로드
  uploadNormalMatrixToShader(); // 모델뷰행렬을 수정했으면, 수정된 모델뷰행렬의 상단 3*3 역전치 행렬도 다시 만들어서 버텍스 셰이더에 재업로드
  drawCube(); // 테이블 윗면이 될 큐브 그리는 함수 호출
  popModelViewMatrix(); // 테이블 윗면을 다 그린 뒤, 함수 첫번째 줄에서 저장해뒀던 모델뷰행렬을 다시 복구시킴.

  // 테이블 다리 그리기
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      pushModelViewMatrix(); // 함수 첫번째 줄에서 저장했다가 다시 복구한 모델뷰행렬을 다시 스택에 저장해 둠.
      mat4.translate(
        pwgl.modelViewMatrix,
        [i * 1.9, -0.1, j * 1.9],
        pwgl.modelViewMatrix
      ); // 각 다리의 버텍스들을 y축으로 -0.1만큼 내리고, XZ축을 기준으로 -1.9 ~ 1.9 사이의 좌표값을 지정하도록 이동 변환 적용.
      mat4.scale(pwgl.modelViewMatrix, [0.1, 1.0, 0.1], pwgl.modelViewMatrix); // y축으로 길쭉한 모양이 되도록 XZ축 기준으로 0.1배 스케일링 변환 적용.
      uploadModelViewMatrixToShader(); // 모델뷰행렬이 바뀌면 버텍스 셰이더에 재업로드
      uploadNormalMatrixToShader(); // 모델뷰행렬을 수정했으면, 수정된 모델뷰행렬의 상단 3*3 역전치 행렬도 다시 만들어서 버텍스 셰이더에 재업로드
      drawCube(); // 테이블 다리가 될 큐브 그리는 함수 호출
      popModelViewMatrix(); // 다음 반복문 넘어가서 새로운 다리를 그리기 전, 현재의 모델뷰행렬을 push해놓은 행렬(draw() 함수에서 y축으로 1.1만큼 이동시킨 거)로 복구함.
    }
  }

  /**
   * 여기서 기억할 점은,
   * 마지막 반복문에서 마지막 다리를 그려준 뒤,
   * popModelViewMatrix(); 해버리게 되면,
   *
   * 현재의 모델뷰 행렬은 draw() 함수에서 y축으로 1.1만큼 이동시킨 모델뷰 행렬로 복구되고,
   * 스택에는 카메라의 뷰 변환만 적용된 모델뷰 행렬만 남게 됨.
   *
   * 또 draw() 함수에서 drawTable() 호출하고 난 뒤,
   * popModelViewMatrix() 를 호출해버리면,
   * 결과적으로 현재 모델뷰행렬에는 뷰 변환만 적용된 모델뷰행렬로 복구가 될것임!
   * -> 여기서부터 다시 시작해서 모델뷰변환을 적용한 다음 테이블 위 큐브를 그리려는 것
   */
}

function draw(currentTime) {
  pwgl.requestId = requestAnimFrame(draw); // 다음 애니메이션 호출 예약을 위해 내부에서 반복 호출.

  if (currentTime === undefined) {
    // DOMHighResTimeStamp 값은 최초 호출(첫 프레임) 시, undefined를 전달하므로,
    // currentTime 값이 필요한 계산을 제대로 해주기 위해 0으로 초기화한 것. -> 원문 코드처럼 Data.now()로 시작하면 원하는 애니메아션이 안나올거임.
    currentTime = 0;
  }

  // 1000ms(1초)가 지났을 때마다 프레임 카운팅을 초기화하고, pwgl.previousFrameTimeStamp 값도 다음 1초를 세기 시작하는 시점의 타임스탬프값으로 갱신해줌.
  if (currentTime - pwgl.previousFrameTimeStamp >= 1000) {
    pwgl.fpsCounter.innerHTML = pwgl.nbrOfFramesForFPS; // 방금 지난 1초 동안 그려온 프레임 수 카운팅한 값을 화면에 찍어줌.
    pwgl.nbrOfFramesForFPS = 0; // 프레임 수 카운터를 0으로 초기화 -> 다음 1초 동안의 프레임 수를 다시 카운트하기 위해서!
    pwgl.previousFrameTimeStamp = currentTime; // 조건문에서 다음 1초를 체크하기 위해, 이전 타임스탬프 값을 1초가 지난 순간의 타임스탬프 값으로 갱신함.
  }

  // NDC 좌표계 -> 윈도우 좌표계로 변환하는 단계(뷰포트 변환)에서, NDC 좌표를 얼마만큼의 윈도우 좌표에 대응시킬 것인지 정해줌.
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // 프레임을 새로 그릴 때마다 색상 버퍼와 깊이 버퍼 값 둘 다 초기화해줌.

  // 초기 투영행렬을 만듦
  mat4.perspective(
    60, // fov
    gl.canvas.width / gl.canvas.height, // aspect
    1, // near
    100.0, // far
    pwgl.projectionMatrix // 결과값(투영행렬)을 할당해 줄 목적지 인자
  );

  // 초기 모델뷰행렬을 만듦. (뷰 변환, 즉 카메라 이동만 적용)
  mat4.identity(pwgl.modelViewMatrix);
  mat4.lookAt([8, 5, 10], [0, 0, 0], [0, 1, 0], pwgl.modelViewMatrix);

  // 투영행렬, 모델뷰행렬을 새로 초기화했으니 버텍스 셰이더에 업로드하는 함수를 호출
  uploadModelViewMatrixToShader();
  uploadProjectionMatrixToShader();

  // 모델뷰행렬을 초기화하고 나면,
  // 버텍스 셰이더에서 노멀 벡터를 눈 좌표계로 변환할 때 사용하는 mat3 행렬을 만들어서 셰이더에 전송하는 함수
  uploadNormalMatrixToShader();

  // 바닥을 그리는 함수 호출
  drawFloor();

  // 테이블 그리기
  // 테이블 그리기 전 초기 모델뷰행렬을 스택에 저장함.
  pushModelViewMatrix();
  mat4.translate(pwgl.modelViewMatrix, [0.0, 1.1, 0.0], pwgl.modelViewMatrix); // 버텍스들을 y축으로 1.1만큼 이동시키는 모델 변환 적용.
  uploadModelViewMatrixToShader(); // 모델뷰행렬을 수정했으면, 버텍스 셰이더에 재업로드.
  uploadNormalMatrixToShader(); // 모델뷰행렬을 수정했으면, 수정된 모델뷰행렬의 상단 3*3 역전치 행렬도 다시 만들어서 버텍스 셰이더에 재업로드 해줘야 함.
  drawTable();
  popModelViewMatrix(); // drawTable() 함수의 마지막 코멘트처럼, 여기서 다시 pop 해주면 현재의 모델뷰행렬은 뷰 변환만 적용된 모델뷰 행렬로 복구됨.

  // 테이블 위 상자 그리기
  pushModelViewMatrix(); // 뷰 변환만 적용된 모델뷰행렬을 스택에 저장해 둠

  if (pwgl.animationStartTime === undefined) {
    // 이 값이 undefined 라는 것은, 첫 프레임에 호출된 draw라고 보면 됨.
    // 즉, 초기값인 undefined가 할당된 상태라면, 위에서 0으로 값을 초기화한 currentTime 값을 넣어줄 것.
    pwgl.animationStartTime = currentTime;
  }

  // 처음 3초 동안은 상자의 높이값을 2.7 에서 5로 이동시키는 애니메이션을 보여주려는 것.
  if (pwgl.y < 5) {
    // 3초 동안의 이동 애니메이션에서, 프레임 레이트가 서로 다른 디바이스라고 해도,
    // 경과된 시간이 같다면 움직인 거리도 같도록 움직임을 보정하는 공식을 사용하여 계산함.
    pwgl.y =
      2.7 + ((currentTime - pwgl.animationStartTime) / 3000) * (5.0 - 2.7);
  } else {
    // 3000ms가 지나 pwgl.y (높이값)이 5를 넘는 순간, if block의 애니메이션은 중단하고,
    // 매 프레임마다 0도 ~ 360도로 점점 증가하는 라디안 각도값을 구한 뒤,
    // 그 각도값에 해당하는 현재 프레임에서의 pwgl.x, z의 원의 좌표값을 계산해 줌.
    // 마찬가지로, 경과된 시간이 같다면, 증가되는 각도값이 같도록 움직임 보정 공식 사용함.
    pwgl.angle =
      (((currentTime - pwgl.animationStartTime) / 2000) * 2 * Math.PI) %
      (2 * Math.PI);

    // 위에서 구한 각도값과 원의 반지름(pwgl.circleRadius)으로 원의 좌표값 pwgl.x, z를 구함.
    pwgl.x = Math.cos(pwgl.angle) * pwgl.circleRadius;
    pwgl.z = Math.sin(pwgl.angle) * pwgl.circleRadius;
  }

  mat4.translate(
    pwgl.modelViewMatrix,
    [pwgl.x, pwgl.y, pwgl.z],
    pwgl.modelViewMatrix
  ); // 위에 if-else block에서 구한 상자의 수직 좌표값(pwgl.y)과 원의 좌표값(pwgl.x, z)로 이동변환을 만들어 줌.
  mat4.scale(pwgl.modelViewMatrix, [0.5, 0.5, 0.5], pwgl.modelViewMatrix); // drawCube() 함수 자체는 모서리가 2인 큐브를 그리므로, scale을 XYZ축 기준 0.5배로 변환 적용하면 모서리가 1인 큐브로 그려지겠군.
  uploadModelViewMatrixToShader(); // 모델뷰행렬이 바뀌었으니 버텍스 셰이더에 재업로드
  uploadNormalMatrixToShader(); // 모델뷰행렬을 수정했으면, 수정된 모델뷰행렬의 상단 3*3 역전치 행렬도 다시 만들어서 버텍스 셰이더에 재업로드 해줘야 함.
  drawCube(); // 테이블 위 상자가 될 큐브 그리는 함수 호출
  popModelViewMatrix(); // 현재 모델뷰행렬을 다시 뷰 변환만 적용된 모델뷰행렬로 복구시킴.

  pwgl.nbrOfFramesForFPS++; // 매 프레임이 그려질 때마다 프레임 카운터를 1씩 증가시켜줌
}

// 컨텍스트 상실 발생하면 호출할 이벤트핸들러 함수
function handleContextLost(e) {
  e.preventDefault();
  cancelRequestAnimFrame(pwgl.reuqestId);
}

// 컨텍스트 복구 시 또는 startup() 함수 내에서
// 웹지엘 설정 및 리소스, 애니메이션 관련 변수들을 초기화해주는 함수. -> 재사용성을 위해 초기화 작업들만 따로 모아서 묶어둔 것!
function init() {
  // 웹지엘 관련 설정 및 리소스 초기화 작업
  setupShaders();
  setupBuffers();
  setupLights();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // 상자 회전 애니메이션이 필요한 변수값 초기화 작업
  pwgl.x = 0.0;
  pwgl.y = 2.7;
  pwgl.z = 0.0;
  pwgl.circleRadius = 4.0;
  pwgl.angle = 0;

  // 프레임 레이트에 따른 움직임 보정 및 FPS 카운터 제작에 필요한 값들 초기화
  pwgl.animationStartTime = undefined;
  pwgl.nbrOfFramesForFPS = 0;
  pwgl.previousFrameTimeStamp = 0; // 얘는 원문 코드처럼 Date.now()가 아닌, 0부터 시작해야 FPS 카운팅을 제대로 시작할 수 있음.
}

// 컨텍스트 복구 발생 시 호출할 이벤트핸들러 함수
function handleContextRestored() {
  init();
  pwgl.requestId = requestAnimFrame(draw, canvas);
}

function startup() {
  canvas = document.getElementById("myGLCanvas");
  canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(canvas); // 원본 캔버스를 감싸는 wrapper를 생성해 'webglcontextlost'와 'webglcontextrestored' 이벤트를 시뮬레이션함.

  // 컨텍스트 상실 및 복구 관련 이벤트핸들러 등록
  canvas.addEventListener("webglcontextlost", handleContextLost, false);
  canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

  gl = createGLContext(canvas);
  init(); // WebGL 관련 설정 및 리소스들, 애니메이션 관련 초기값들을 초기화해주는 함수

  // 지난 1초 동안 렌더링된 프레임 수(FPS)를 값으로 넣어서 표시해 줄 요소를 가져옴.
  pwgl.fpsCounter = document.getElementById("fps");

  // 마우스 클릭 시 webglcontextlost 이벤트를 발생시키는 이벤트핸들러. -> 시뮬레이션을 해주고 싶으면 주석 처리를 풀면 됨.
  // window.addEventListener("mousedown", function () {
  //   canvas.loseContext();
  // });

  draw();
}

/**
 * 참고!
 *
 * 이 예제에서는 6-1 예제와 달리,
 * 상자 회전 애니메이션 자체는 구현하고 있지만,
 *
 * 사용자로부터 키 입력을 받아서
 * 회전 반경을 조절하는 기능은 구현하지 않은 것 같음.
 */

/**
 * 자바스크립트에서 버텍스 셰이더로 노멀 벡터 데이터 전달하는 방법
 *
 *
 * 0. 일단 노멀 벡터의 개념부터 정리
 *
 * 노멀 벡터란, 삼각형과 같은 주어진 기하도형에 수직인 벡터(선)을 의미한다고 보면 됨.
 *
 * 웹지엘에서는 버텍스 셰이더로 넘어오는 각 버텍스 위치별로
 * 노멀 벡터값을 구해야 하는 경우가 있는데,
 *
 * 주로 버텍스 셰이더에서 해당 벡터의 밝기값을 계산해야 하는 상황에서
 * 디퓨즈 성분을 계산할 때 노멀 벡터가 필요하고,
 * 스펙큘러 성분 계산에 필요한 반사 벡터를 구할 때 노멀 벡터가 필요함.
 *
 * 이럴 경우 자바스크립트에서 각 벡터의 노멀 데이터를 WebGLBuffer로 기록한 다음
 * 버텍스 셰이더로 쏴주는 방식으로 사용하는 경우가 있음.
 *
 *
 * 1. 각 버텍스들의 노멀 데이터가 기록된 WebGLBuffer 객체 생성
 *
 * 텍스처 좌표, 색상, 버텍스 위치 등 여느 버텍스 데이터를 적재하는 것과 마찬가지로
 * 노멀 데이터를 버텍스 셰이더에 전달하려면 일단 WebGLBuffer 객체부터 생성해야 한다.
 *
 * 이 때, 예제에서 사용된 바닥면, 큐브처럼
 * 웹지엘 좌표계 축과 면의 방향이 일치하는 오브젝트는
 * 별다른 계산이 없어도 그냥
 * 해당 면과 수직인 축의 좌표값을 1.0(음의 축과 수직일 경우 -1.0)으로 두고,
 * 나머지 좌표값을 0.0으로 두면 됨.
 *
 * 예를 들어, 예제에서는 바닥면이 양의 y축을 향하고 있으므로,
 * 양의 y축과 수직이다. 따라서, 바닥면의 모든 버텍스들에 대해
 * (0.0, 1.0, 0.0) 이런 식으로 동일하게 노멀 데이터를 기록하면 됨.
 *
 * 그러나, 좌표계 축과 면의 방향이 일치하지 않는 오브젝트는
 * 이거보다는 좀 더 복잡한 계산을 해줘야 하지만, 그렇게 어렵진 않다.
 *
 * 이럴 경우, 선형대수학에서 '외적'의 개념을 이용하면 됨.
 * 한 점에서 만나는 두 벡터 u, v를 '외적' 하면
 * 결과값 벡터는 두 벡터 u, v 모두에 수직인 벡터 w를 얻게 되는데,
 * 벡터 w는 결국 두 벡터 u, v가 만나는 점(= 버텍스)의 '노멀 벡터'와도 동일함.
 *
 * 아래 함수는 glMatrix 라이브러리에는 두 벡터의 외적을 이용해서
 * 노말 벡터를 쉽게 계산해주는 내장함수.
 *
 * vec3.cross(vector1, vector2, normal(결과값 벡터가 저장될 목적지 인자))
 *
 *
 * 참고!)
 * 큐브의 경우, 위의 바닥면 예제에서의 케이스와 마찬가지로,
 * 각각의 면은 노멀 벡터가 서로 다르지만,
 * 같은 면에 존재하는 버텍스들이라면, 노멀 데이터가 같다고 보면 됨.
 *
 *
 * 2. 노말을 눈 좌표계로 변환할 때 필요한 '모델뷰행렬의 상단 3*3 역전치 행렬'을 만듦.
 *
 * index.html의 버텍스 셰이더 관련 내용에도 정리했었지만,
 * 조명 계산을 할때는, 버텍스의 모든 데이터들(좌표, 노멀)을 눈 좌표계로 맞춰준 뒤에 계산해야 함.
 *
 * 버텍스 좌표 데이터는 모델뷰행렬을 곱해주면 바로 변환되는데,
 * 버텍스 노멀은 그렇지 않음. 모델뷰행렬 말고 어떤 특별한 행렬을 따로 만들어서 곱해줘야 하는데,
 * 이 특별한 행렬이 바로 책에서 말하는 '모델뷰행렬의 상단 3*3 역전치 행렬' 임.
 *
 * glMatrix 라이브러리를 이용하여 이 특별한 행렬을 만들어준 다음에,
 * 버텍스 셰이더에 전송해줘야 하는데 이 과정이 특히 좀 복잡하고 혼란스러울 수 있음.
 * 그러나 아래의 기본적인 규칙을 잘 이해하면 너무 어렵지 않게 생각해도 됨.
 *
 * -첫째, mat3.create()로 3*3 행렬을 만들기 위한 준비를 함.
 * -둘째, mat4.toInverseMat3()로 모델뷰행렬의 상단 3*3 행렬의 역행렬을 구함. 역행렬에 관한 내용은 p.70 참고.
 * -셋째, mat3.transpose()로 둘째 단계에서 구한 상단 3*3 역행렬을 인자로 넣어 전치시켜 줌.
 *
 * 위의 세 단계를 따르면 normalMatrix에는 '모델뷰행렬의 상단 3*3 역전치 행렬'이 만들어지게 됨.
 *
 *
 * 3. 2번에서 만든 '모델뷰행렬의 상단 3*3 역전치 행렬'을 버텍스 셰이더로 업로드함
 *
 * uploadModelViewMatrixToShader(), uploadProjectionMatrixToShader() 함수와 마찬가지로,
 * 버텍스 셰이더에서 사용할 행렬을 초기화하거나 수정했다면, 버텍스 셰이더로 (재)업로드 해줘야 함.
 *
 * gl.uniformMatrix4fv() 메서드를 이용해서 uNMatrix 유니폼 변수에
 * 2번에서 만든 행렬을 전송해주면 됨.
 *
 * 그럼 버텍스 셰이더에서 저 행렬을 각 버텍스의 노멀 데이터와 곱해줘서
 * 눈 좌표계로 변환해줄거임.
 */
