# Samsung S90C developer mode and port 26101

This process was tested on a 2023 Samsung S90C, model QN65S90CDFXZA.
Samsung menus and developer behavior can differ by model year and firmware.

## Open the Developer Mode popup

On this S90C, entering `12345` from the main Apps screen or while highlighting
an app did nothing.

1. Open **Apps**.
2. Scroll all the way to the bottom.
3. Open **App Settings**.
4. Enter `12345` and wait. Do not press **Done**.
5. The Developer Mode popup should appear.
6. Turn Developer Mode **On**.
7. Enter the local IP address of the computer running `sdb` as the Host PC IP.
8. Press **OK**.

If the remote has no number buttons, press its `123` button to open the number
pad.

## Check the network addresses

The Host PC IP is the local address of the computer running Tizen Studio or
`sdb`. It is not the TV address and it should not be a Tailscale address.

If the devices move from home Wi-Fi to an Android hotspot, the computer receives
a new IP address. Find that new address and enter it on the TV. Reusing the
computer's home Wi-Fi address will prevent the developer connection.

The TV, computer and phone must be on the same local network when a phone
hotspot is used. Each device still has its own address.

During troubleshooting on the tested S90C:

- Tailscale and other VPN connections were disabled.
- Wi-Fi 6E and automatic band switching were disabled.
- The local addresses were checked after every network change.

It is not clear whether disabling Wi-Fi 6E was required. It is included here
because that was the network state when the connection succeeded.

## Fully remove power

Turning the tested TV off and on with the remote did not open TCP port 26101.
Developer Mode remained visible, but the port returned `connection refused`.

After saving the correct Host PC IP:

1. Unplug the TV from power.
2. Leave it unplugged for 30 seconds.
3. Plug it back in and start it.

The computer was pinging the TV about once per second and checking port 26101
during this attempt:

```sh
ping <TV-IP>
```

In a second terminal on macOS:

```sh
while true; do
  nc -zv -G 1 <TV-IP> 26101
  sleep 1
done
```

Press Control-C to stop either command.

The ping stopped while the TV had no power. When the TV returned, port 26101
was open and `sdb` connected. The monitoring did not open the port by itself.
It confirmed that the TV had fully lost power and showed when the developer
service became available.

Port 8002 is Samsung's remote-control port. It can respond while developer port
26101 remains closed.

## Connect with sdb

```sh
sdb connect <TV-IP>:26101
sdb devices
```

The TV should appear in the device list.

## Create the signing profile

Install Tizen Studio with the TV extension and Samsung certificate extension.
Sign in to a Samsung account, then create:

1. An author certificate.
2. A distributor certificate that includes the TV's device ID.

Back up the certificates somewhere outside the repository. Never commit `.p12`
files or certificate passwords.

## Build, sign and install

```sh
npm install
npm run tizen-build
tizen package -t wgt -s <PROFILE-NAME> -- dist -o .
tizen install -n Crunchyroll.wgt -s <TV-IP>:26101 -- /path/to/crunchyroll-tizen-s90c
tizen run -s <TV-IP>:26101 -p qXuEoRvlCp.Crunchyroll
```

For `tizen package`, the value after `-s` is the security profile name. It is
not the TV IP address. Using the TV address there can produce an unsigned
package followed by:

```text
install failed[118, -12]
Check certificate error
```

The `-s` value used by `tizen install` and `tizen run` is different. Those
commands expect the target TV address.

## Related documentation

- [Samsung: Using SDK with a TV device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)
- [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download)
