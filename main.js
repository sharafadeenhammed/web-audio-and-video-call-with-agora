let localStream = null;
let remoteStream = null;
let peerConnection = null;
let agoraClient = null;
let agoraChannel = null;
const APP_ID = "your-agora-app-id";
const uid = `${Math.floor(Math.random() * 100000)}`;
const token = null;
const servers = {
  iceServers: [
    {
      urls:["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    }
  ]
}

// request video and audio access and setup local video stream
async function init() {
  // create agora client
   agoraClient = new AgoraRTM.createInstance(APP_ID);

  // login to agora
  await agoraClient.login({ uid, token }).then((data)=>console.log("login okay: ", data)).catch((error)=>console.log("Error login: ", error));

  // create agora channel and join, 
   agoraChannel = await agoraClient.createChannel("test-channel");
  await agoraChannel.join();

  agoraChannel.on("MemberJoined", handleUserJoin);

  agoraChannel.on("MemberLeft", handleUserLeft);
  
  agoraClient.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  const localVideoStream = document.getElementById("user-1");
  localVideoStream.srcObject = localStream;
}


async function createPeerConnection(memberId) {
  peerConnection = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();

  // set remote media to user-2 
  const remoteVideoStream = document.getElementById("user-2");
  remoteVideoStream.srcObject = remoteStream;

  // show user-2 video feed
  document.getElementById("user-2").style.display = "block";


  // create local stream if not created
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const localVideoStream = document.getElementById("user-1");
    localVideoStream.srcObject = localStream;
  }
  
  // set local track medias to peer conection hanedeler
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  
  // add event listener for track media changes from remote user
  peerConnection.ontrack = (event) => {
    event.streams[ 0 ].getTracks().forEach(track => remoteStream.addTrack(track));
  }

  // listen for local desciption ... setLocalDesciption fires off onicecandidate event
  peerConnection.onicecandidate = async function (event) {
    if (event.candidate) {
      await agoraClient.sendMessageToPeer({ text: JSON.stringify({ type: "candidate", candidate: event.candidate })}, memberId );
    }
  }
}

async function createOffer(memberId) {
  await createPeerConnection(memberId);
  // create offer and add as local description to peer connection
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await agoraClient.sendMessageToPeer({ text: JSON.stringify({ type: "offer", offer})}, memberId );
}

async function createAnswer(memberId, offer) {
  await createPeerConnection(memberId);
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await agoraClient.sendMessageToPeer({ text: JSON.stringify({ type: "answer", answer})}, memberId );
}

async function addAnswer(memberId, answer) {
  if (!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(answer);
  }
}

async function handleUserJoin(memberId) {
  console.log("a new member has joined: ", memberId);
  await createOffer(memberId);
}

async function handleMessageFromPeer(message, memberId) {
  console.log("message: ", message); 
  const messageData = JSON.parse(message.text);
  if (messageData.type === "offer") {
    createAnswer(memberId, messageData.offer);
  }
  if (messageData.type === "answer") {
    addAnswer(memberId, messageData.answer);
  }
  if (messageData.type === "candidate") { 
    if (peerConnection) {
      peerConnection.addIceCandidate(messageData.candidate);
    }
  }
}

async function handleUserLeft(memberId) {
  console.log("user left: ", memberId);
  document.getElementById("user-2").style.display = "none";
}

async function leaveChannel() {
  await agoraChannel.leave();
  await agoraClient.logout();
}




window.addEventListener("beforeunload", leaveChannel);


init();


