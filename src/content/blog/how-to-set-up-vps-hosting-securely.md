---
title: "How to Set Up Your Own VPS Hosting (and Actually Secure It)"
description: "A plain-English, step-by-step walkthrough for setting up your first VPS: picking a provider, locking down SSH, a firewall, automatic updates, and getting a domain live with SSL."
category: "Infrastructure"
publishedDate: "2026-07-24"
readTime: "8 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<p>Every one of our own products — this site included — runs on a VPS we manage ourselves rather than a managed platform-as-a-service. That scares a lot of people off, and reasonably so: "server" sounds like something that requires a computer science degree to touch safely. It doesn't. A VPS is just a computer someone else keeps switched on and connected to the internet, that you get to log into. The setup below is the same handful of steps we run on every new box, and it takes about 20 minutes once you've done it once.</p>

<div class="honest-note">
<strong>None of this for you?</strong> If a terminal genuinely isn't your thing, that's fine — skip everything below and use shared hosting instead, where someone else handles the server entirely. Hostinger's plans scale by how many sites you need to run: <a href="https://www.hostinger.com/cart?product=hosting%3Ahostinger_premium&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947f-042e-7210-85b3-d97b5802a7a2" rel="sponsored noopener" target="_blank">Premium</a> (up to 3 sites), <a href="https://www.hostinger.com/cart?product=hosting%3Ahostinger_business&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947f-313d-722d-88b7-aefb5db7ea31" rel="sponsored noopener" target="_blank">Business</a> (up to 50), or <a href="https://www.hostinger.com/cart?product=hosting%3Acloud_economy&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947f-9334-725d-aef9-21900643a9ee" rel="sponsored noopener" target="_blank">Cloud Economy</a> (up to 100). No SSH, no firewall, nothing below applies to you. Read on if you want the control a VPS gives you instead.
</div>

<h2>What a VPS actually is (and when you don't need one)</h2>
<p>A VPS (virtual private server) is a slice of a physical machine in a data centre, rented to you as your own private Linux box with root access. That's different from shared hosting (where you don't get real server access) and different from a platform like Vercel or Render (where someone else manages the server for you, for a price, in exchange for less control).</p>
<p>You want a VPS when you're running your own Docker containers, a database, or anything that doesn't fit neatly into a managed platform's pricing model. You don't need one if a managed platform already does what you need — there's no prize for self-hosting something that would take five minutes on someone else's infrastructure. Be honest with yourself about which camp you're in before you start.</p>

<h2>Step 1: Pick a provider</h2>
<p>For a first VPS, we point people at <strong><a href="https://www.hostinger.com/cart?product=vps%3Avps_kvm_1&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947d-0490-7339-8841-9e8c00c7ce76" rel="sponsored noopener" target="_blank">Hostinger</a></strong> — it's what we run our own stack on. The <a href="https://www.hostinger.com/cart?product=vps%3Avps_kvm_1&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947d-0490-7339-8841-9e8c00c7ce76" rel="sponsored noopener" target="_blank">KVM 1</a> plan is enough to follow along with everything below; if you end up running several Docker containers side by side, <a href="https://www.hostinger.com/cart?product=vps%3Avps_kvm_2&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947b-ca4a-7132-8ceb-c0bfcdd9b538" rel="sponsored noopener" target="_blank">KVM 2</a> gives you more headroom. If you're planning to host a whole portfolio of sites and services on one box the way we do, jump straight to <a href="https://www.hostinger.com/cart?product=vps%3Avps_kvm_4&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947d-4234-7003-ae6d-5d7aa2f4122d" rel="sponsored noopener" target="_blank">KVM 4</a> instead of upgrading later. All three come with a one-click Ubuntu image and a control panel that doesn't get in the way once you're comfortable on the command line.</p>
<p>If data residency matters to you — you're handling Australian customer data and want it to legally stay onshore, or your customers are AU-based and you want the latency win — an Australia-based host is worth the extra cost once you're past the "just get something live" stage. <strong>Binary Lane</strong> is the one we'd look at first: data centres in Sydney, Melbourne, Perth, and Brisbane, straightforward Docker support, and a solid reputation among Australian developers (it comes up favourably on Whirlpool, which is the forum Australians actually trust for this). <strong>Crucial</strong> is a reasonable second option, Sydney-based and aimed at the same developer audience. Neither is necessary on day one — get comfortable on a cheap box first, migrate later if data sovereignty becomes a real requirement rather than a nice-to-have.</p>

<h2>Step 2: Get in, and immediately stop being root</h2>
<p>You'll get root SSH access on day one. The first thing to do is stop using it. Running everything as root means one mistake — a bad <code>rm</code>, a compromised script — has no safety net.</p>
<pre><code># as root, create a new user and give it sudo rights
adduser yourname
usermod -aG sudo yourname</code></pre>
<p>Log out, log back in as <code>yourname</code>, and do everything from here on with <code>sudo</code> in front of anything that needs root.</p>

<h2>Step 3: SSH keys, not passwords</h2>
<p>Password-based SSH login is the single biggest reason random VPSes get compromised — bots scan the entire internet for port 22 and brute-force common passwords all day, every day. Switch to key-based auth before you do anything else public-facing.</p>
<p>On your own machine (not the server):</p>
<pre><code>ssh-keygen -t ed25519 -C "yourname@yourserver"
ssh-copy-id yourname@your-server-ip</code></pre>
<p>Then on the server, edit <code>/etc/ssh/sshd_config</code> and set:</p>
<pre><code>PasswordAuthentication no
PermitRootLogin no</code></pre>
<p>Restart SSH (<code>sudo systemctl restart sshd</code>) and test logging in from a <em>new</em> terminal window before you close your current session — if something's wrong with the key setup, you want to still be logged in to fix it, not locked out.</p>

<h2>Step 4: A firewall — only open what you actually use</h2>
<p><code>ufw</code> (uncomplicated firewall) ships on most distros and is genuinely simple to use. The rule of thumb: deny everything by default, then explicitly allow only the ports you need.</p>
<pre><code>sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable</code></pre>
<p>That's SSH, HTTP, and HTTPS — enough to run a web app behind a reverse proxy. Don't open a port "just in case." Every open port is one more thing that has to stay secure forever.</p>

<h2>Step 5: Fail2ban and automatic updates</h2>
<p>Two more five-minute jobs that quietly do a lot of work. <code>fail2ban</code> watches auth logs and temporarily bans IPs that fail login too many times — useful even with key-only SSH, since it also covers other services you might add later.</p>
<pre><code>sudo apt install fail2ban -y
sudo systemctl enable --now fail2ban</code></pre>
<p>And unattended security updates, so you're not the last one to know about a critical patch:</p>
<pre><code>sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades</code></pre>

<h2>Step 6: Docker, and a reverse proxy for SSL</h2>
<p>This is the point where the server starts being useful. We run everything as Docker containers, and we put <a href="https://nginxproxymanager.com/" rel="noopener" target="_blank">Nginx Proxy Manager</a> in front of them — it's a small web UI that handles reverse proxying and Let's Encrypt SSL certificates without hand-editing nginx config every time you add a new domain.</p>
<pre><code>curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker yourname</code></pre>
<p>Point your domain's DNS at the server's IP, add it as a proxy host in Nginx Proxy Manager, tick "request a new SSL certificate," and you have a real HTTPS site in a couple of minutes — no separate certificate wrangling.</p>

<h2>Where this breaks</h2>
<p>Being honest: this is real, ongoing responsibility, not a one-time setup you forget about. Security patches, disk space filling up, a container that quietly stops restarting after a crash, a certificate that doesn't auto-renew the way you assumed — someone has to notice these things. For a single side project that's a manageable trade against the cost saving. For something a business actually depends on, "someone has to notice these things" becomes a real operational cost, and it's worth being honest with yourself about whether that someone is actually going to be you at 11pm on a Sunday.</p>

<h2>Practical next step</h2>
<p>Spin up a <a href="https://www.hostinger.com/cart?product=vps%3Avps_kvm_1&amp;period=12&amp;referral_type=cart_link&amp;REFERRALCODE=ETHGENMAIJMP&amp;referral_id=019f947d-0490-7339-8841-9e8c00c7ce76" rel="sponsored noopener" target="_blank">KVM 1 box on Hostinger</a>, work through steps 2–5 in order — user, keys, firewall, fail2ban — before you install anything else. That's the part that actually matters for security; everything after it is just software. If you get through that and decide you'd rather not be the one getting paged when it breaks, that's exactly what our <a href="/services/ai-infrastructure.html">AI infrastructure</a> service line is for.</p>

<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you'd rather we just run the infrastructure for you — see
<a href="/services/ai-infrastructure.html">AI infrastructure</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
