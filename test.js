let APP_ID = "34b65813e6674990a2d0fc05ca9e1495";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if (!roomId) {
    window.location = 'lobby.html';
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let constraints = {
    video: true,
    audio: true
};

let init = async () => {
    try {
        client = await AgoraRTM.createInstance(APP_ID);
        await client.login({ uid, token });

        channel = client.createChannel(roomId);
        await channel.join();

        channel.on('MemberJoined', handleUserJoined);
        channel.on('MemberLeft', handleUserLeft);

        client.on('MessageFromPeer', handleMessageFromPeer);

        // Requesting user media
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('user-1').srcObject = localStream;
        console.log("Local stream initialized");
    } catch (error) {
        console.error('Failed to initialize', error);

        // Display error to the user
        alert('Failed to access camera and/or microphone. Please ensure that the necessary permissions are granted and no other application is using the camera.');
    }
};

let handleUserLeft = (MemberId) => {
    console.log('User left the channel:', MemberId);
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
};

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        await createAnswer(MemberId, message.offer);
    }

    if (message.type === 'answer') {
        await addAnswer(message.answer);
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            await peerConnection.addIceCandidate(message.candidate);
        }
    }
};

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId);
    await createOffer(MemberId);
};

let createPeerConnection = async (MemberId) => {
    try {
        peerConnection = new RTCPeerConnection(servers);

        remoteStream = new MediaStream();
        document.getElementById('user-2').srcObject = remoteStream;
        document.getElementById('user-2').style.display = 'block';

        document.getElementById('user-1').classList.add('smallFrame');

        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            document.getElementById('user-1').srcObject = localStream;
        }

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };

        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId);
            }
        };

        console.log("Peer connection created");
    } catch (error) {
        console.error('Failed to create peer connection', error);
    }
};

let createOffer = async (MemberId) => {
    try {
        await createPeerConnection(MemberId);

        let offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId);

        console.log("Offer created and sent");
    } catch (error) {
        console.error('Failed to create offer', error);
    }
};

let createAnswer = async (MemberId, offer) => {
    try {
        await createPeerConnection(MemberId);

        await peerConnection.setRemoteDescription(offer);

        let answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId);

        console.log("Answer created and sent");
    } catch (error) {
        console.error('Failed to create answer', error);
    }
};

let addAnswer = async (answer) => {
    try {
        if (!peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(answer);
        }

        console.log("Answer added");
    } catch (error) {
        console.error('Failed to add answer', error);
    }
};

let leaveChannel = async () => {
    try {
        await channel.leave();
        await client.logout();
    } catch (error) {
        console.error('Failed to leave the channel', error);
    }
};

let toggleCamera = async () => {
    try {
        let videoTrack = localStream.getTracks().find(track => track.kind === 'video');

        if (videoTrack.enabled) {
            videoTrack.enabled = false;
            document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
        } else {
            videoTrack.enabled = true;
            document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)';
        }

        console.log("Camera toggled");
    } catch (error) {
        console.error('Failed to toggle camera', error);
    }
};

let toggleMic = async () => {
    try {
        let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');

        if (audioTrack.enabled) {
            audioTrack.enabled = false;
            document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
        } else {
            audioTrack.enabled = true;
            document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)';
        }

        console.log("Microphone toggled");
    } catch (error) {
        console.error('Failed to toggle microphone', error);
    }
};

window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();
