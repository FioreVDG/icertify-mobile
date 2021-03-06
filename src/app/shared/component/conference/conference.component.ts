import { ModalController } from '@ionic/angular';
/* eslint-disable @angular-eslint/no-output-on-prefix */
import { AlertController } from '@ionic/angular';
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/type-annotation-spacing */
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import {
  AgoraClient,
  ClientEvent,
  NgxAgoraService,
  StreamEvent,
  Stream,
} from 'ngx-agora';
import { User } from 'src/app/models/user.interface';
import { ApiService } from 'src/app/services/api/api.service';
import {
  DropEvent,
  DroppableDirective,
  ValidateDrop,
} from 'angular-draggable-droppable';
import { DBMeter } from '@ionic-native/db-meter/ngx';
const enum Status {
  OFF = 0,
  RESIZE = 1,
  MOVE = 2,
}

@Component({
  selector: 'app-conference',
  templateUrl: './conference.component.html',
  styleUrls: ['./conference.component.scss'],
})
export class ConferenceComponent implements OnInit {
  @ViewChild('meter') meterRef!: ElementRef;
  @Input() channelName: string = '';
  @Input() me: any;
  @ViewChild('agora_local') videoContainer;
  @ViewChild('remote') remoteVideo;

  public width!: number;
  public height!: number;
  public left!: number;
  public top!: number;
  @ViewChild('agora_local', { read: ElementRef }) public box!: ElementRef;
  private boxPosition!: { left: number; top: number };
  private containerPos!: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  public mouse!: { x: number; y: number };
  public status: Status = Status.OFF;
  private mouseClick!: { x: number; y: number; left: number; top: number };

  private video: HTMLVideoElement;
  private video2: HTMLVideoElement;

  localCallId = 'agora_local';
  remoteCalls: Array<any> = [];

  private client: AgoraClient;
  private localStream: Stream;
  private uid: string = '';
  private token: string = '';
  public localAudio: boolean = true;
  public localVideo: boolean = true;
  tempSrc: any;

  soundMeter: any;

  @Output() onLeaveMeeting: any = new EventEmitter<any>();
  @Output() setActualDate: any = new EventEmitter<any>();
  @Output() initVideo: any = new EventEmitter<any>();

  loading: any;
  toasting: any;

  async presentToast(msg: any) {
    this.toasting = await this.toast.create({
      message: `${msg}`,
      duration: 3000,
    });
    await this.toasting.present();
  }
  async presentLoading(msg: any) {
    this.loading = await this.loadingController.create({
      message: `${msg}`,
    });
    await this.loading.present();
  }

  constructor(
    private ngxAgoraService: NgxAgoraService,
    private api: ApiService,
    private toast: ToastController,
    public loadingController: LoadingController,
    public mc: ModalController,
    private alertController: AlertController,
    private dbMeter: DBMeter
  ) {
    this.video = document.createElement('video');
    this.video.style.width = '100%';
    this.video.style.height = '100%';
    this.video.style.transform = 'rotateY(180deg)';
    this.video.setAttribute('autoplay', '');
    console.log(this.video);
  }

  ngOnInit() {
    document.getElementById('agora_local').appendChild(this.video);
    this.initWebRTC();
    this.initSoundMeter();
    // console.log(this.box.nativeElement);
  }

  ngAfterViewInit() {
    // this.loadBox();
    this.loadContainer();
  }

  private loadContainer() {
    const left = this.boxPosition.left - this.left;
    const top = this.boxPosition.top - this.top;
    const right = left + 600;
    const bottom = top + 450;
    this.containerPos = { left, top, right, bottom };
  }

  private loadBox() {
    const { left, top } = this.box.nativeElement.getBoundingClientRect();
    this.boxPosition = { left, top };
  }
  setStatus(event: MouseEvent, status: number) {
    console.log(event);
    if (status === 1) event.stopPropagation();
    else if (status === 2)
      this.mouseClick = {
        x: event.clientX,
        y: event.clientY,
        left: this.left,
        top: this.top,
      };
    else this.loadBox();
    this.status = status;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouse = { x: event.clientX, y: event.clientY };

    // if (this.status === Status.RESIZE) this.resize();
    // else
    if (this.status === Status.MOVE) this.move();
  }

  private move() {
    if (this.moveCondMeet()) {
      this.left = this.mouseClick.left + (this.mouse.x - this.mouseClick.x);
      this.top = this.mouseClick.top + (this.mouse.y - this.mouseClick.y);
    }
  }

  private moveCondMeet() {
    const offsetLeft = this.mouseClick.x - this.boxPosition.left;
    const offsetRight = this.width - offsetLeft;
    const offsetTop = this.mouseClick.y - this.boxPosition.top;
    const offsetBottom = this.height - offsetTop;
    return (
      this.mouse.x > this.containerPos.left + offsetLeft &&
      this.mouse.x < this.containerPos.right - offsetRight &&
      this.mouse.y > this.containerPos.top + offsetTop &&
      this.mouse.y < this.containerPos.bottom - offsetBottom
    );
  }

  // ionViewDidEnter() {
  //   document.getElementById('agora_local').appendChild(this.video);
  //   this.initWebRTC();
  // }

  initSoundMeter() {
    this.soundMeter = this.dbMeter.start().subscribe(
      (instant) => {
        console.log(instant);
        this.meterRef && this.localAudio
          ? (this.meterRef.nativeElement.value = instant)
          : (this.meterRef.nativeElement.value = 0);
      },
      (error) =>
        console.debug(
          'navigator.MediaDevices.getUserMedia error: ',
          error.message,
          error.name
        )
    );
  }
  ngOnDestroy(): void {
    this.soundMeter?.unsubscribe();
    this.dbMeter.delete().then(
      () => console.log('Deleted DB Meter instance'),
      (error) => console.log('Error occurred while deleting DB Meter instance')
    );
  }

  initWebRTC() {
    const constraints = {
      video: true,
      audio: false,
    };

    const handleSuccess = (stream: MediaStream) => {
      // this.localStream.muteVideo();
      (<any>window).stream = stream;
      this.video.srcObject = stream;
      // this.video.style.display = 'none';
      this.tempSrc = stream;
      setTimeout(() => {
        // this.localStream.unmuteVideo();
        this.startConference();
      }, 500);
    };

    const handleError = (error: any) => {
      const p = document.createElement('p');
      p.innerHTML =
        'navigator.getUserMedia error: ' + error.name + ', ' + error.message;
      this.videoContainer.nativeElement.appendChild(p);
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(handleSuccess)
      .catch(handleError);
  }

  startConference() {
    this.presentLoading('Entering Room...');
    this.api.agora.getToken(this.channelName).subscribe(
      (res: any) => {
        console.log(res);
        if (res) {
          this.token = res.env.token;
          this.uid = this.me._id;
          this.client = this.ngxAgoraService.createClient({
            mode: 'rtc',
            codec: 'h264',
          });
          this.assignClientHandlers();

          this.localStream = this.ngxAgoraService.createStream({
            streamID: this.uid,
            audio: this.localAudio,
            video: this.localVideo,
            screen: false,
          });
          console.log(this.localStream);
          this.assignLocalStreamHandlers();

          this.initLocalStream(() =>
            this.join(
              (uid) => {
                this.publish();
                this.initVideo.emit();
                this.loading.dismiss();
              },
              (error) => {
                console.error(error);
                this.loading.dismiss();
              }
            )
          );
        }
      },
      (err: any) => {
        console.log(err);
        this.loading.dismiss();
      }
    );
  }

  join(
    onSuccess?: (uid: number | string) => void,
    onFailure?: (error: Error) => void
  ): void {
    this.client.join(
      this.token,
      this.channelName,
      this.uid,
      onSuccess,
      onFailure
    );
  }

  publish(): void {
    this.client.publish(this.localStream, (err) =>
      console.log('Publish local stream error: ' + err)
    );
  }

  private assignClientHandlers(): void {
    this.client.on(ClientEvent.LocalStreamPublished, (evt) => {
      console.log('Publish local stream successfully');
    });

    this.client.on(ClientEvent.Error, (error) => {
      console.log('Got error msg:', error.reason);
      if (error.reason === 'DYNAMIC_KEY_TIMEOUT') {
        this.client.renewChannelKey(
          '',
          () => console.log('Renewed the channel key successfully.'),
          (renewError) =>
            console.error('Renew channel key failed: ', renewError)
        );
      }
    });

    this.client.on(ClientEvent.RemoteStreamAdded, (evt) => {
      console.log('-- Remote Stream Added');
      const stream = evt.stream;
      this.client.subscribe(stream, { audio: true, video: true }, (err) => {
        console.log('Subscribe stream failed', err);
      });
    });

    this.client.on(ClientEvent.RemoteStreamSubscribed, (evt) => {
      console.log('-- Remote Stream Subcribed');
      const stream = evt.stream;
      const id = this.getRemoteId(stream);
      if (!this.remoteCalls.length) {
        this.setActualDate.emit();
        this.remoteCalls.push(id);
        this.video2 = document.createElement('video');
        this.video2.style.width = 'inherit';
        this.video2.style.height = 'inherit';
        this.video.style.transform = 'rotateY(180deg)';
        this.video2.setAttribute('autoplay', '');
        this.video2.srcObject = stream.stream;
        this.video2.onloadedmetadata = () => {
          this.video2.play();
        };
        console.log(this.video2);
        setTimeout(() => {
          document.getElementById('remote')?.appendChild(this.video2);
        }, 500);
      } else {
        document.getElementById('remote')?.removeChild(this.video2);
      }
    });

    this.client.on(ClientEvent.RemoteStreamRemoved, (evt) => {
      console.log('-- Remote Stream Removed');
      const stream = evt.stream;
      if (stream) {
        stream.stop();
        this.remoteCalls = [];
        console.log(`Remote stream is removed ${stream.getId()}`);
        document.getElementById('remote')?.removeChild(this.video2);
      }
    });

    this.client.on(ClientEvent.PeerLeave, (evt) => {
      console.log('-- Peer Leave');
      const stream = evt.stream as Stream;
      if (stream) {
        stream.stop();
        this.remoteCalls = this.remoteCalls.filter(
          (call) => call !== `${this.getRemoteId(stream)}`
        );
        console.log(`${evt.uid} left from this channel`);
        document.getElementById('remote')?.removeChild(this.video2);
      }
    });
  }

  private assignLocalStreamHandlers(): void {
    this.localStream.on(StreamEvent.MediaAccessAllowed, () => {
      console.log('accessAllowed');
    });

    // The user has denied access to the camera and mic.
    this.localStream.on(StreamEvent.MediaAccessDenied, () => {
      console.log('accessDenied');
    });
  }

  private initLocalStream(onSuccess?: () => any): void {
    this.localStream.init(
      () => {
        // The user has granted access to the camera and mic.
        this.localStream.play(this.localCallId);
        if (onSuccess) {
          onSuccess();
        }
      },
      (err) => console.error('getUserMedia failed', err)
    );
  }

  private getRemoteId(stream: Stream): string {
    return `agora_remote-${stream.getId()}`;
  }

  leave() {
    this.client.stopLiveStreaming;
    this.client.leave(
      () => {
        this.localStream.stop();
        this.localStream.close();
        this.onLeaveMeeting.emit();
        console.log('Leavel channel successfully');
      },
      (err) => {
        console.log('Leave channel failed');
      }
    );
  }

  toggleAudio() {
    console.log('MIC');
    if (this.localAudio) {
      this.localStream.muteAudio();
    } else {
      this.localStream.unmuteAudio();
    }
    this.localAudio = !this.localAudio;
    console.log(this.localAudio);
  }

  toggleVideo() {
    console.log('VIDEO');
    if (this.localVideo) {
      this.localStream.muteVideo();
      this.video.srcObject = null;
      this.video.style.display = 'none';
    } else {
      this.localStream.unmuteVideo();
      this.video.srcObject = this.tempSrc;
    }
    this.localVideo = !this.localVideo;
    console.log(this.localVideo);
  }

  private joinAgain() {
    console.log('5. Join & Publish Triggers');
    this.join(
      (uid) => this.publish(),
      (error) => console.error(error)
    );
  }

  async presentAlertConfirm() {
    const alert = await this.alertController.create({
      cssClass: '',
      header: 'Before you proceed!',
      message: '<strong>Are you sure you want to leave the meeting</strong>!!!',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          id: 'cancel-button',
          handler: (blah) => {},
        },
        {
          text: 'Okay',
          id: 'confirm-button',
          handler: () => {
            this.leave();
          },
        },
      ],
    });

    await alert.present();
  }

  droppedData: string = '';

  @ViewChild(DroppableDirective, { read: ElementRef, static: true })
  droppableElement: ElementRef;

  onDrop({ dropData }: DropEvent<string>): void {
    this.droppedData = dropData;
    console.log(this.droppedData);
    setTimeout(() => {
      this.droppedData = '';
    }, 2000);
  }

  validateDrop: ValidateDrop = ({ target }) =>
    this.droppableElement.nativeElement.contains(target as Node);
}
